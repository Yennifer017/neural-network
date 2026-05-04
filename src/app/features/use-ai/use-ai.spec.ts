import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UseAI } from './use-ai';

describe('UseAI', () => {
  let component: UseAI;
  let fixture: ComponentFixture<UseAI>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UseAI]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UseAI);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
