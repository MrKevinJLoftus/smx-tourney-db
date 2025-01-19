import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private duration = 5;

  constructor(private snackbar: MatSnackBar) { }

  show(message: string, closeBtnText = 'Dismiss') {
    this.snackbar.open(message, closeBtnText, {
      duration: this.duration * 1000
    });
  }
}
