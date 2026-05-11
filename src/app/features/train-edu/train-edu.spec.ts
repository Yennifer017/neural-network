import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainEdu } from './train-edu';

describe('TrainEdu', () => {
  let component: TrainEdu;
  let fixture: ComponentFixture<TrainEdu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainEdu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainEdu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
