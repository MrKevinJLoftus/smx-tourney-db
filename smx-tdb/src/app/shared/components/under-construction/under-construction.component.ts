import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-under-construction',
  templateUrl: './under-construction.component.html',
  styleUrl: './under-construction.component.scss',
  standalone: false
})
export class UnderConstructionComponent implements OnInit {
  @Input() pageName?: string;
  @Input() inProgress = false;

  constructor() { }

  get pageContext(): string {
    return (this.pageName) ? `"${this.pageName}"` : `This`;
  }

  ngOnInit(): void {
  }

}
