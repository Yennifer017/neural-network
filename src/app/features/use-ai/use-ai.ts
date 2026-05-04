import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { AiService } from '../../core/services/ai.service';
import { PredictionResponse } from '../../core/schemas/ai.schema';

@Component({
  selector: 'app-use-ai',
  imports: [],
  templateUrl: './use-ai.html',
  styleUrl: './use-ai.css',
})
export class UseAI implements AfterViewInit {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  private _activeMode: string = 'draw';
  prediction: number | null = null;

  private isDrawing = false;
  private ctx!: CanvasRenderingContext2D;
  private videoStream: MediaStream | null = null;

  selectedFile = null;
  previewUrl: string | null = null;

  constructor(
    private aiService: AiService
  ) { }

  // Setter para manejar cambios de modo y disparar acciones
  set activeMode(mode: string) {
    this._activeMode = mode;

    if (mode === 'camera') {
      this.setupCamera();
    } else {
      this.stopCamera(); // Apagamos la cámara si salimos del modo
    }
  }

  get activeMode(): string {
    return this._activeMode;
  }

  ngAfterViewInit() {
    this.initCanvas();
  }

  initCanvas() {
    const canvas = this.canvasElement.nativeElement;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // Configuración "Modo Claro"
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.ctx.strokeStyle = "black"; // Trazo oscuro
    this.ctx.lineWidth = 22; // Grosor para que la IA lo vea bien
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Mouse Events
    canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDrawing());
    canvas.addEventListener('mouseleave', () => this.stopDrawing());

    // Touch Events
    canvas.addEventListener('touchstart', (e) => this.startDrawing(e.touches[0]), { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  private getCoordinates(e: MouseEvent | Touch): { x: number, y: number } {
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();

    // Calculamos la escala entre el tamaño interno (400x400) 
    // y el tamaño que se muestra en pantalla (CSS)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  private startDrawing(e: MouseEvent | Touch) {
    this.isDrawing = true;
    const coords = this.getCoordinates(e);

    this.ctx.beginPath();
    this.ctx.moveTo(coords.x, coords.y);
  }

  private draw(e: MouseEvent | Touch) {
    if (!this.isDrawing) return;
    const coords = this.getCoordinates(e);

    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();
  }

  private stopDrawing() {
    this.isDrawing = false;
  }

  clearCanvas() {
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, 400, 400);
    this.prediction = null;
  }

  async setupCamera() {
    if (this.videoStream) return;

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.videoElement.nativeElement.srcObject = this.videoStream;
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
    }
  }

  stopCamera() {
    if (this.videoStream) {
      // Obtenemos todas las pistas (video/audio) y las detenemos
      this.videoStream.getTracks().forEach(track => track.stop());

      // Limpiamos las referencias
      this.videoElement.nativeElement.srcObject = null;
      this.videoStream = null;
      console.log("Cámara apagada y stream liberado.");
    }
  }

  async processImage() {
    let imageBase64 = '';

    if (this.activeMode === 'draw') {
      // Captura del Canvas
      imageBase64 = this.canvasElement.nativeElement.toDataURL('image/png');
      await this.sendToApi(imageBase64);
    }

    else if (this.activeMode === 'camera') {
      // Captura de la Cámara
      const tempCanvas = document.createElement('canvas');
      const video = this.videoElement.nativeElement;

      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;

      const ctx = tempCanvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      imageBase64 = tempCanvas.toDataURL('image/png');
      await this.sendToApi(imageBase64);
    }

    else if (this.activeMode === 'upload') {
      if (this.selectedFile) {
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          await this.sendToApi(e.target.result);
        };
        reader.readAsDataURL(this.selectedFile);
      } else {
        alert("Por favor, selecciona una imagen primero.");
      }
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;

      // Crear la previsualización
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private base64ToFile(base64Image: string, fileName: string): File {
    // Extraemos solo la parte de los datos del string (quitamos el prefix data:image/png;base64,)
    const parts = base64Image.split(';base64,');
    const imageType = parts[0].split(':')[1];
    const decodedData = window.atob(parts[1]);

    // Creamos un array de bytes
    const uInt8Array = new Uint8Array(decodedData.length);
    for (let i = 0; i < decodedData.length; ++i) {
      uInt8Array[i] = decodedData.charCodeAt(i);
    }

    // Retornamos el archivo listo para el servicio
    return new File([uInt8Array], fileName, { type: imageType });
  }

  async sendToApi(base64Data: string) {
    console.log("Enviando al backend");
    this.prediction = null;

    const file = this.base64ToFile(base64Data, 'canvas_draw.png');
    this.aiService.predictDigit(file).subscribe({
      next: (response: PredictionResponse) => {
        // 3. Actualizamos con los datos reales de la IA
        this.prediction = response.prediction;
        console.log('IA dice que es un:', response.prediction);
      },
      error: (err) => {
        console.error('Error en la predicción:', err);
        this.prediction = null;
        alert("La IA se confundió, intenta de nuevo.");
      },
      complete: () => {
        console.log('Procesamiento completado');
      }
    });
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
