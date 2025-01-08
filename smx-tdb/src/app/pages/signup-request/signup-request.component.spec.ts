import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignupRequestComponent } from './signup-request.component';

describe('SignupRequestComponent', () => {
  let component: SignupRequestComponent;
  let fixture: ComponentFixture<SignupRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignupRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
