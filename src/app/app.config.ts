import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

/**
 * Gestor Global de Erros (Enterprise Grade).
 * Previne que exceções não tratadas travem o ciclo de vida do Angular silenciosamente.
 * Preparado para integração futura com plataformas de Observabilidade (ex: Sentry, Datadog).
 */
class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[Crash Report] Ocorreu uma falha na aplicação:', error);
    // TODO: Adicionar serviço de telemetria aqui se necessário no futuro
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    // OTIMIZAÇÃO CRÍTICA DE PERFORMANCE (CPU/Bateria):
    // O 'eventCoalescing' agrupa múltiplos eventos síncronos do DOM (ex: Scroll veloz, múltiplos cliques)
    // num único ciclo de deteção de alterações. Reduz drasticamente o "Jank" em aplicações pesadas como editores de PDF.
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // Configuração do Router com foco em UX Premium
    provideRouter(
      routes,
      withViewTransitions(), // Transições de ecrã nativas e suaves ao estilo de apps móveis
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }) // Restaura o scroll para o topo ao mudar de "página"
    ),

    // Injeção do tratamento robusto de exceções
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
