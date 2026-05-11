import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainMenu } from './train-menu';

describe('TrainMenu', () => {
  let component: TrainMenu;
  let fixture: ComponentFixture<TrainMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainMenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
