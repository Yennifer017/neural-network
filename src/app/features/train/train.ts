import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AiService } from '../../core/services/ai.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  standalone: true,
  selector: 'app-train',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    BaseChartDirective
  ],
  templateUrl: './train.html',
  styleUrl: './train.css',
})
export class Train {

  trainingForm: FormGroup;
  selectedFiles: File[] = [];

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

  submitTraining() {
    if (this.isValidConfig) {
      const values = this.trainingForm.getRawValue();
      const isAuto = values.auto_train;

      this.epochsDisplay = values.epochs;
      if (isAuto) {
        this.submitAutoTraining(values);
      } else {
        // CASO MANUAL: Mandas parámetros + imágenes + respuestas
        const payload = {
          epochs: values.epochs,
          batch_size: values.batch_size,
          learning_rate: values.learning_rate,
          labels: values.labels.split(',').map((l: string) => l.trim()),
          images: this.selectedFiles, // Array de archivos File
          mode: 'manual'
        };
        console.log('Enviando configuración manual con imágenes:', payload);
      }
    }
  }

  /*---------------------------------------------
  ----------- conexion con los sockets ----------
  ----------------------------------------------*/

  submitAutoTraining(values: any) {

    const socket = this.aiService.connectAutoTraining(
      values.epochs,
      values.batch_size,
      values.learning_rate,
      false
    );

    socket.onopen = () => {
      console.log('WebSocket conectado');
    };

    socket.onmessage = (event) => {

      const data = JSON.parse(event.data);
      console.log('Mensaje recibido:', data);

      if (data.status === 'processing') {
        alert('Empezando entrenamiento...');
      }

      if (data.general) {
        this.currentEpoch = data.general.epoch + 1;
        this.accuracy = data.general.accuracy;
        this.currentLoss = data.general.loss
        this.lossHistory.push(data.general.loss);
        console.log("deberia cambiar")

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

      if (data.status === 'finished') {
        alert('Entrenamiento finalizado');
        this.lineChartData = {
          ...this.lineChartData
        };
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
