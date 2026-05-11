import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';
import { AiService } from '../../core/services/ai.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-train-menu',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './train-menu.html',
  styleUrl: './train-menu.css',
})
export class TrainMenu {
  useRandomValues: boolean = true;

  constructor(
    private reportsService: ReportsService,
    private aiService: AiService
  ) { }

  resetTraining() {
    this.aiService.restartNetwork(this.useRandomValues ).subscribe({
      next: () => {
        alert('La red neuronal fue reiniciada correctamente');
      },
      error: (error) => {
        console.error(error);
        alert('Ocurrió un error al reiniciar la red neuronal');
      }
    });
  }

  downloadDefaults() {
    this.reportsService.downloadDefaultWeights().subscribe(blob => {

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'default-weights.json';

      a.click();

      window.URL.revokeObjectURL(url);
    });
  }

  downloadMatrixLog() {
    this.reportsService.downloadMatrixLog().subscribe(blob => {

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'matrix-log.log';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
