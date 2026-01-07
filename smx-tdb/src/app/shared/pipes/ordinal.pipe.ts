import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ordinal',
  standalone: true
})
export class OrdinalPipe implements PipeTransform {
  transform(value: number): string {
    if (isNaN(value)) return value.toString();

    const v = value % 100;
    // Special cases for 11th, 12th, 13th
    if (v >= 11 && v <= 13) {
      return value + "th";
    }
    // General cases based on the last digit
    switch (value % 10) {
      case 1:
        return value + "st";
      case 2:
        return value + "nd";
      case 3:
        return value + "rd";
      default:
        return value + "th";
    }
  }
}

