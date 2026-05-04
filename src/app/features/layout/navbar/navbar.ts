import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit{

  private router = inject(Router);
  links: any[] = [];
  isMenuOpen: boolean = false;


  ngOnInit(): void {
    this.loadLinks();
  }

  loadLinks() {
    this.links = [
      { label: 'Home', url: '/home' },
      { label: 'Try', url: '/ai/try' },
      { label: 'Train', url: '/ai/train' },
    ];
  }

}
