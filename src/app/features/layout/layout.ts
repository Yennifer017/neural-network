import { Component, DOCUMENT, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Navbar } from './navbar/navbar';


@Component({
  selector: 'app-client-layouts',
  imports: [CommonModule, RouterModule, Navbar],
  standalone: true,
  template: `
    <div class="flex h-screen bg-slate-100">
      <div class="flex-1 overflow-y-auto">
        <app-navbar></app-navbar>
        <router-outlet></router-outlet>
      </div>
    </div>
  `
})

export class Layout {


}
