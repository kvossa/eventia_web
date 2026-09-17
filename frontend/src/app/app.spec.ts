import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const header = fixture.nativeElement as HTMLElement;
    expect(header.querySelector('.header .brand')?.textContent).toContain('eventia');
  });
});