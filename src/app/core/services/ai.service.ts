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

}