import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import Konva from 'konva';

@Component({
  selector: 'app-train-edu',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    BaseChartDirective,

  ],
  templateUrl: './train-edu.html',
  styleUrl: './train-edu.css',
})
export class TrainEdu implements AfterViewInit {
  trainingForm: FormGroup;
  selectedFiles: File[] = [];

  @ViewChild('networkContainer', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  public showLegend: boolean = false; // Por defecto cerrada

  private stage!: Konva.Stage;

  private connectionsLayer = new Konva.Layer();

  private neuronsLayer = new Konva.Layer();

  /*
   * Referencias rápidas
   */
  private neuronMap =
    new Map<string, Konva.Circle>();

  private connectionMap =
    new Map<string, Konva.Line>();

  private renderPending = false;

  ngAfterViewInit(): void {

    this.initializeCanvas();

    this.renderNetwork();

    this.enableZoom();
  }


  constructor(
    private aiService: AiService,
    private fb: FormBuilder
  ) {
    this.trainingForm = this.fb.group({
      epochs: [10, [Validators.required, Validators.min(1)]],
      batch_size: [32, [Validators.required, Validators.min(1)]],
      learning_rate: [0.01, [Validators.required, Validators.min(0.0001)]],
      auto_train: [true],
      labels: [{ value: '', disabled: true }] // Deshabilitado si auto_train es true
    });

    // Cambiar estado de labels según el toggle de auto_train
    this.trainingForm.get('auto_train')?.valueChanges.subscribe(isAuto => {
      const labelsControl = this.trainingForm.get('labels');
      if (isAuto) {
        labelsControl?.disable();
        this.selectedFiles = [];
        labelsControl?.setValue('');
      } else {
        labelsControl?.enable();
        labelsControl?.setValidators([Validators.required]);
      }
      labelsControl?.updateValueAndValidity();
    });
  }

  onFileChange(event: any) {
    this.selectedFiles = Array.from(event.target.files);
  }

  // Validador visual para contar comas vs imágenes
  get labelCount(): number {
    const val = this.trainingForm.get('labels')?.value;
    if (!val) return 0;
    return val.split(',').filter((x: string) => x.trim() !== '').length;
  }

  get isValidConfig(): boolean {
    if (this.trainingForm.get('auto_train')?.value) return this.trainingForm.valid;
    // Si es manual, debe haber imágenes y la misma cantidad de etiquetas
    return this.trainingForm.valid &&
      this.selectedFiles.length > 0 &&
      this.labelCount === this.selectedFiles.length;
  }

  /*---------------------------------------------
  ----------- Train ----------
  ----------------------------------------------*/

  epochsDisplay: number = 0;
  currentEpoch: number = 0;
  accuracy: number = 0;
  lossHistory: number[] = [];
  currentLoss: number = 0;

  lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Loss'
      }
    ]
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    animation: false
  };

  async submitTraining() {
    if (this.isValidConfig) {
      const values = this.trainingForm.getRawValue();
      const isAuto = values.auto_train;

      this.epochsDisplay = values.epochs;
      this.lossHistory = [];
      let socket;
      if (isAuto) {
        socket = this.aiService.connectAutoTraining(
          values.epochs,
          values.batch_size,
          values.learning_rate,
          true
        );
      } else {
        const labels = values.labels
          .split(',')
          .map((l: string) => Number(l.trim()));

        socket = await this.aiService.connectManualTraining(
          this.selectedFiles,
          labels,
          values.epochs,
          values.batch_size,
          values.learning_rate,
          true
        );
      }
      this.consumeSocket(values, socket)
    }
  }

  /*--------------------------------------------------------------------------
 --------------------------------- visualizacion de la red neuronal ----------
 ------------------------------------------------------------------------------*/
  private initializeCanvas(): void {

    const container =
      this.containerRef.nativeElement;

    const width =
      container.clientWidth || window.innerWidth;

    const height =
      container.clientHeight || window.innerHeight;

    this.stage = new Konva.Stage({
      container,
      width,
      height,
      draggable: true
    });

    this.stage.add(
      this.connectionsLayer
    );

    this.stage.add(
      this.neuronsLayer
    );

    window.addEventListener('resize', () => {

      this.stage.width(
        window.innerWidth
      );

      this.stage.height(
        window.innerHeight
      );

      this.stage.batchDraw();
    });
  }

  private renderNetwork(): void {
    const layers = [
      { name: 'input', neurons: 784, isGrid: true }, // Marcamos que es grid
      { name: 'hidden', neurons: 64, isGrid: false },
      { name: 'output', neurons: 10, isGrid: false }
    ];

    const stageHeight = this.stage.height();
    const layerSpacing = 450;
    const neuronRadius = 4;
    const gridSpacing = 10; // Espacio entre neuronas del grid 28x28

    const layerPositions: { label: string, x: number, y: number }[][] = [];

    layers.forEach((layer, layerIndex) => {
      const currentLayer: { label: string, x: number, y: number }[] = [];
      const baseX = 150 + (layerIndex * layerSpacing);

      if (layer.isGrid) {
        // --- Lógica de Rejilla 28x28 ---
        const gridSize = 28;
        const gridTotalWidth = gridSize * gridSpacing;
        const gridTotalHeight = gridSize * gridSpacing;

        // Centramos el grid verticalmente
        const gridStartY = (stageHeight - gridTotalHeight) / 2;

        for (let i = 0; i < layer.neurons; i++) {
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;

          const x = baseX + (col * gridSpacing);
          const y = gridStartY + (row * gridSpacing);

          const neuronLabel = `${layer.name}_${i}`;
          this.createNeuron(x, y, neuronRadius, neuronLabel, currentLayer);
        }
      } else {
        // --- Lógica Lineal (Hidden y Output) ---
        const spacingY = Math.min(18, (stageHeight - 100) / layer.neurons);
        const totalHeight = spacingY * layer.neurons;
        const startY = (stageHeight - totalHeight) / 2;

        for (let i = 0; i < layer.neurons; i++) {
          const x = baseX;
          const y = startY + (i * spacingY);

          const neuronLabel = `${layer.name}_${i}`;
          this.createNeuron(x, y, neuronRadius, neuronLabel, currentLayer);
        }
      }
      layerPositions.push(currentLayer);
    });

    this.drawConnections(layerPositions);

    // Optimizaciones finales
    //this.connectionsLayer.cache();
    this.connectionsLayer.draw();
    this.neuronsLayer.draw();
    this.stage.batchDraw();
  }


  // Método auxiliar para no repetir código de creación de círculo
  private createNeuron(x: number, y: number, radius: number, label: string, layerArray: any[]): void {
    const neuron = new Konva.Circle({
      x, y,
      radius: radius,
      fill: '#1e293b',
      stroke: '#64748b',
      strokeWidth: 1,
      listening: false
    });

    this.neuronsLayer.add(neuron);
    this.neuronMap.set(label, neuron);
    layerArray.push({ label, x, y });
  }

  private drawConnections(layerPositions: { label: string, x: number, y: number }[][]): void {
    // Limpiamos por si acaso hay restos de un renderizado previo
    this.connectionsLayer.destroyChildren();
    this.connectionMap.clear();

    for (let i = 0; i < layerPositions.length - 1; i++) {
      const currentLayer = layerPositions[i];
      const nextLayer = layerPositions[i + 1];

      currentLayer.forEach((source) => {
        nextLayer.forEach((target) => {
          const connectionLabel = `${source.label}->${target.label}`;

          const line = new Konva.Line({
            points: [source.x, source.y, target.x, target.y],
            stroke: '#334155', // Color base (puedes usar slate-700)
            strokeWidth: 0.35,
            opacity: 0.12,
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            hitGraphEnabled: false, // Desactiva la detección de eventos de dibujo
            transformsEnabled: 'position'
          });

          this.connectionsLayer.add(line);

          // Guardamos la referencia para actualizar el peso después
          this.connectionMap.set(connectionLabel, line);
        });
      });
    }
  }

  /*
   * Zoom
   */
  private zoomTimeout: any;


  private enableZoom(): void {
    // --- Dragging ---
    this.stage.on('dragstart', () => {
      this.connectionsLayer.hide();
    });

    this.stage.on('dragend', () => {
      this.connectionsLayer.show();
      this.connectionsLayer.batchDraw();
    });

    // --- Zoom ---
    this.stage.on('wheel', (event) => {
      event.evt.preventDefault();

      // 1. Ocultar conexiones para ganar performance
      if (this.connectionsLayer.visible()) {
        this.connectionsLayer.hide();
      }

      const scaleBy = 1.05; // Factor de sensibilidad
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();

      if (!pointer) return;

      // 2. Cálculos matemáticos del zoom (esto es lo que faltaba)
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };

      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

      // 3. Aplicar escala y nueva posición
      this.stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      this.stage.position(newPos);

      // Dibujamos solo neuronas mientras scrolleas
      this.stage.batchDraw();

      // 4. Timeout para restaurar las conexiones cuando el usuario para
      clearTimeout(this.zoomTimeout);
      this.zoomTimeout = setTimeout(() => {
        this.connectionsLayer.show();
        this.connectionsLayer.batchDraw();
      }, 150);
    });
  }

  /*
   * Render inteligente
   */
  private requestRender(): void {

    if (this.renderPending) {
      return;
    }

    this.renderPending = true;

    requestAnimationFrame(() => {

      this.connectionsLayer.batchDraw();

      this.neuronsLayer.batchDraw();

      this.renderPending = false;
    });
  }

  /*
   * Actualiza neurona
   */
  public updateNeuron(
    neuronLabel: string,
    activation: number
  ): void {

    const neuron =
      this.neuronMap.get(neuronLabel);

    if (!neuron) {
      return;
    }

    const intensity =
      Math.floor(activation * 255);

    neuron.fill(
      `rgb(${intensity}, ${intensity}, 255)`
    );

    neuron.radius(
      4 + activation * 4
    );

    this.requestRender();
  }

  /*
   * Actualiza conexión
   */
  public updateConnection(connectionLabel: string, weight: number): void {
    const connection = this.connectionMap.get(connectionLabel);

    if (!connection) return;

    const abs = Math.abs(weight);

    // Cambiar color: Verde para positivo, Rojo para negativo
    connection.stroke(weight >= 0 ? '#22c55e' : '#ef4444');

    // Grosor basado en la fuerza del peso
    connection.strokeWidth(0.2 + abs * 2);

    // Opacidad: Pesos débiles casi invisibles
    connection.opacity(0.1 + abs * 0.8);

    // Si notas que no se actualiza, es por el cache. 
    // Esta línea fuerza a Konva a redibujar esa zona.
    this.requestRender();
  }

  /*
   * DEMO
   * Simula actividad
   */
  public randomizeDemo(): void {

    setInterval(() => {

      /*
       * Neurona random
       */
      const neuronIndex =
        Math.floor(Math.random() * 64);

      this.updateNeuron(
        `hidden_${neuronIndex}`,
        Math.random()
      );

      /*
       * Conexión random
       */
      const inputIndex =
        Math.floor(Math.random() * 784);

      const hiddenIndex =
        Math.floor(Math.random() * 64);

      const weight =
        (Math.random() * 2) - 1;

      this.updateConnection(
        `input_${inputIndex}->hidden_${hiddenIndex}`,
        weight
      );

    }, 30);
  }


  // ...

  private updateNetworkWithRealData(forward: any): void {
    console.log("Actualizando red con datos reales del backend...");

    // 1. ACTUALIZAR NEURONAS DE ENTRADA (input_values)
    // Estas son las activaciones 'a' de la capa de entrada (los píxeles)
    forward.input_values.forEach((value: number, i: number) => {
      this.updateNeuron(`input_${i}`, value);
    });

    // 2. ACTUALIZAR CAPA OCULTA (Hidden Layer)
    // Actualizar Neuronas (Activaciones 'a')
    forward.hidden_layer.a.forEach((activation: number, i: number) => {
      this.updateNeuron(`hidden_${i}`, activation);
    });

    // Actualizar Pesos (Input -> Hidden)
    // weights suele ser una matriz [num_neuronas_hidden][num_neuronas_input]
    forward.hidden_layer.weights.forEach((neuronWeights: number[], hiddenIdx: number) => {
      neuronWeights.forEach((weight: number, inputIdx: number) => {
        this.updateConnection(`input_${inputIdx}->hidden_${hiddenIdx}`, weight);
      });
    });

    // 3. ACTUALIZAR CAPA DE SALIDA (Output Layer)
    // Actualizar Neuronas (Activaciones 'a')
    forward.output_layer.a.forEach((activation: number, i: number) => {
      this.updateNeuron(`output_${i}`, activation);
    });

    // Actualizar Pesos (Hidden -> Output)
    forward.output_layer.weights.forEach((neuronWeights: number[], outputIdx: number) => {
      neuronWeights.forEach((weight: number, hiddenIdx: number) => {
        this.updateConnection(`hidden_${hiddenIdx}->output_${outputIdx}`, weight);
      });
    });

    // 4. Renderizar cambios
    this.requestRender();

    alert(`Predicción del modelo:"${forward.prediction}`);
  }


  private updateNetworkBackward(backward: any): void {
    console.log("Visualizando gradientes y actualizaciones de pesos...");

    // 1. CAPA DE SALIDA (Output Layer)
    // El loss_gradient nos dice cuánto se equivocó cada neurona de salida
    backward.output_layer.loss_gradient.forEach((grad: number, i: number) => {
      this.updateNeuronError(`output_${i}`, grad);
    });

    // Actualizar conexiones Hidden -> Output con los gradientes de pesos
    backward.output_layer.weight_updates.forEach((neuronGrads: number[], outputIdx: number) => {
      neuronGrads.forEach((gradValue: number, hiddenIdx: number) => {
        // Aquí 'gradValue' es cuánto debe cambiar el peso
        this.updateConnection(`hidden_${hiddenIdx}->output_${outputIdx}`, gradValue);
      });
    });

    // 2. CAPA OCULTA (Hidden Layer)
    // local_gradient o incoming_error representan el error propagado hacia atrás
    backward.hidden_layer.local_gradient.forEach((grad: number, i: number) => {
      this.updateNeuronError(`hidden_${i}`, grad);
    });

    // Actualizar conexiones Input -> Hidden con los gradientes de pesos
    backward.hidden_layer.weight_updates.forEach((neuronGrads: number[], hiddenIdx: number) => {
      neuronGrads.forEach((gradValue: number, inputIdx: number) => {
        this.updateConnection(`input_${inputIdx}->hidden_${hiddenIdx}`, gradValue);
      });
    });

    this.requestRender();
  }

  /**
   * Método especial para colorear el error en la neurona
   */
  private updateNeuronError(label: string, gradient: number): void {
    const neuron = this.neuronMap.get(label);
    if (!neuron) return;

    // Usamos una escala de colores distinta para el error (Gradiente)
    // Por ejemplo: Púrpura para error negativo, Naranja para positivo
    const absGrad = Math.min(1, Math.abs(gradient) * 5); // Amplificamos para ver el cambio
    const color = gradient >= 0 ? `rgb(255, 165, ${255 - (absGrad * 255)})` : `rgb(138, 43, 226)`;

    neuron.fill(color);
    neuron.stroke('#ffffff'); // Borde blanco para resaltar que está en modo backward
    neuron.strokeWidth(1.5);
  }





  /*----------------------------------------------------------------------
  ------------------------------------- conexion con los sockets ----------
  ------------------------------------------------------------------------*/


  private trainingSocket?: WebSocket;
  currentOperation: string = "Nothing";

  onNextStep(): void {

    if (!this.trainingSocket) {

      alert(
        'No hay socket activo'
      );

      return;
    }

    if (
      this.trainingSocket.readyState !==
      WebSocket.OPEN
    ) {

      alert(
        'Socket no disponible'
      );

      return;
    }

    this.trainingSocket.send(
      JSON.stringify({
        action: 'next'
      })
    );
  }





  consumeSocket(values: any, socket: WebSocket) {

    this.trainingSocket = socket;

    socket.onmessage = (event) => {

      const data = JSON.parse(event.data);
      console.log('Mensaje recibido:', data);

      if (data.status) {
        alert(data.status);
      } else

        if (data.general) {
          this.currentEpoch = data.general.epoch + 1;
          this.accuracy = data.general.accuracy;
          this.currentLoss = data.general.loss
          this.lossHistory.push(data.general.loss);

          //grafico
          this.lineChartData.labels?.push(
            `${data.general.epoch}`
          );

          this.lineChartData.datasets[0].data.push(
            data.general.loss
          );

          this.lineChartData = {
            ...this.lineChartData
          };
        }

      if (data.forward) {
        this.updateNetworkWithRealData(data.forward);
        this.currentOperation = "Forward"
      }

      if (data.backward) {
        this.updateNetworkBackward(data.backward);
        this.currentOperation = "Backpropagation"
      }

      if (data.status === 'finished') {
        this.lineChartData = {
          ...this.lineChartData
        };
        this.currentOperation = "Nothing";
        socket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('Error WebSocket:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket cerrado');
    };

  }
}
