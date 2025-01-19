import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpResponse } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoadingService } from '../../services/loading.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    // set loading flag to true
    this.loadingService.setIsLoading(true);
    // add auth token to request
    const authToken = this.authService.getToken();
    const authRequest = req.clone({
      headers: req.headers.set('Authorization', 'Bearer ' + authToken)
    });
    return next.handle(authRequest)
      .pipe(
        tap(evt => {
          if (evt instanceof HttpResponse) {
            this.loadingService.setIsLoading(false);
          }
        }),
        catchError((error: any) => {
          this.loadingService.setIsLoading(false);
          return throwError(() => new Error(error));
        })
      );
  }
}
