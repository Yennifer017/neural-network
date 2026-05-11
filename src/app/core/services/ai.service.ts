import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environment';
import { PredictionResponse } from '../schemas/ai.schema';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiService {
    private baseUrl = environment.backend;

    constructor(private http: HttpClient) { }

    predictDigit(file: File): Observable<PredictionResponse> {
        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<PredictionResponse>(
            `${this.baseUrl}/ai/predict`,
            formData
        );
    }

    restartNetwork(randomize: boolean = true): Observable<void> {

        const params = new HttpParams()
            .set('randomize', randomize);

        return this.http.post<void>(
            `${this.baseUrl}/ai/restart`,
            {},
            { params }
        );
    }

    connectAutoTraining(
        epochs: number,
        batchSize: number,
        learningRate: number,
        eduMode: boolean = false
    ): WebSocket {

        const wsUrl =
            `${this.baseUrl.replace('http', 'ws')}` +
            `/ai/realtime/train/auto` +
            `?epochs=${epochs}` +
            `&batch_size=${batchSize}` +
            `&learning_rate=${learningRate}` +
            `&edu_mode=${eduMode}`;

        return new WebSocket(wsUrl);
    }

    async connectManualTraining(
        files: File[],
        labels: number[],
        epochs: number,
        batchSize: number,
        learningRate: number,
        eduMode: boolean = false
    ): Promise<WebSocket> {

        const wsUrl = `${this.baseUrl.replace('http', 'ws')}/ai/realtime/train/manual`;
        const socket = new WebSocket(wsUrl);

        const fileToBase64 = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const result = reader.result as string;
                    // EXTRAEMOS SOLO EL BASE64 (quitamos "data:...;base64,")
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = (error) => reject(error);
            });
        };

        socket.onopen = async () => {
            try {
                // Procesamos todos los archivos a base64 puro
                const base64Files = await Promise.all(files.map(f => fileToBase64(f)));

                socket.send(JSON.stringify({
                    files: base64Files,
                    labels,
                    epochs,
                    batch_size: batchSize,
                    learning_rate: learningRate,
                    edu_mode: eduMode
                }));

                console.log('Base64 puro enviado al backend');
            } catch (error) {
                console.error('Error procesando imágenes:', error);
                socket.close();
            }
        };

        return socket;
    }


}