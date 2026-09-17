import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';
import { Footer } from './shell/footer';
import { Header } from './shell/header';

@Component({
  imports: [RouterOutlet, Header, Footer],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  async ngOnInit(): Promise<void> {
    await this.auth.initialize().catch(() => undefined);
  }
}