import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environment';
import { PredictionResponse } from '../schemas/ai.schema';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportsService {
    private baseUrl = environment.backend;

    constructor(private http: HttpClient) { }

    downloadMatrixLog(): Observable<Blob> {
        return this.http.get(
            `${this.baseUrl}/reports/matrix-log`,
            {
                responseType: 'blob'
            }
        );
    }

    downloadDefaultWeights(): Observable<Blob> {
        return this.http.get(
            `${this.baseUrl}/reports/default-weights`,
            {
                responseType: 'blob'
            }
        );
    }

}