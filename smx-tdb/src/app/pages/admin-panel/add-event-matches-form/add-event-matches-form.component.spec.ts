import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEventMatchesFormComponent } from './add-event-matches-form.component';

describe('AddEventMatchesFormComponent', () => {
  let component: AddEventMatchesFormComponent;
  let fixture: ComponentFixture<AddEventMatchesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEventMatchesFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddEventMatchesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
