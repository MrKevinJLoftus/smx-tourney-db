import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateNewEventFormComponent } from './create-new-event-form.component';

describe('CreateNewEventFormComponent', () => {
  let component: CreateNewEventFormComponent;
  let fixture: ComponentFixture<CreateNewEventFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateNewEventFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateNewEventFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
