import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEventUsersFormComponent } from './add-event-users-form.component';

describe('AddEventUsersFormComponent', () => {
  let component: AddEventUsersFormComponent;
  let fixture: ComponentFixture<AddEventUsersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEventUsersFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddEventUsersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
