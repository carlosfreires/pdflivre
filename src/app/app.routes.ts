import { Routes } from '@angular/router';

/**
 * ============================================================================
 * ARQUITETURA DE ROTEAMENTO (State-based SPA vs URL-based)
 * ============================================================================
 * * Atualmente, a aplicação utiliza "State-based Routing" via Signals diretamente
 * no AppComponent ('editor' | 'merge' | 'split'). 
 * * Porquê?
 * Sendo esta uma aplicação pesada de processamento Client-Side (WASM/WebGL), 
 * o documento PDF reside exclusivamente na RAM (ArrayBuffer). Se utilizássemos 
 * URLs diferentes para cada ecrã, o utilizador poderia recarregar a aba (F5) 
 * ou usar o botão "Voltar" do navegador, resultando na perda imediata e irrecuperável 
 * do trabalho em progresso.
 * * O array de rotas é mantido vazio, porém instanciado, para garantir escalabilidade 
 * futura (ex: rotas estáticas como '/termos-de-servico' ou '/sobre').
 */
export const routes: Routes = [];
