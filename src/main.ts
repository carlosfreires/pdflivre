// OTIMIZAÇÃO ARCH: O polyfill do Zone.js deve ser importado rigorosamente no topo.
// Ele "remenda" APIs assíncronas do browser (setTimeout, Promises) para que o 
// Angular consiga intercetá-las e executar a deteção de alterações (Change Detection).
import 'zone.js';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * ============================================================================
 * BOOTSTRAP DA APLICAÇÃO (Entry Point)
 * ============================================================================
 * Inicia o ciclo de vida do Angular utilizando a arquitetura Standalone.
 * A configuração global (Providers, Router, Error Handling) é importada de appConfig.
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err: unknown) => {
    // OTIMIZAÇÃO ARCH: Ponto de interceção crítico para falhas de arranque.
    // Em produção, este é o local ideal para despachar erros para um serviço 
    // de monitorização de Frontend (como Sentry ou LogRocket) antes da UI morrer.
    console.error('[App Bootstrap] Falha crítica ao inicializar a aplicação Angular:', err);
    
    // Fallback de UX: Se a aplicação falhar completamente no arranque,
    // injetamos uma mensagem amigável no DOM diretamente.
    const rootElement = document.querySelector('app-root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; padding:20px; background:#f8fafc;">
          <h2 style="color:#dc2626;">Desculpe, ocorreu um erro inesperado.</h2>
          <p style="color:#475569;">Não foi possível iniciar a aplicação. Por favor, recarregue a página ou limpe o cache do navegador.</p>
          <button onclick="window.location.reload()" style="margin-top:20px; padding:10px 20px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer;">Recarregar Página</button>
        </div>
      `;
    }
  });