import { Component, ChangeDetectionStrategy, inject, signal, HostListener, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';

// Serviços
import { PdfStateService } from './shared/services/pdf-state.service';

// Componentes do Editor (Módulo 1)
import { ToolbarComponent } from './shared/components/toolbar.component';
import { SidebarComponent } from './shared/components/sidebar.component';
import { ViewerComponent } from './features/viewer/viewer.component';

// Componentes de Operação (Módulos 2 e 3)
import { MergeComponent } from './features/operations/merge.component';
import { SplitComponent } from './features/operations/split.component';

export type AppRoute = 'editor' | 'merge' | 'split';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    SidebarComponent,
    ViewerComponent,
    MergeComponent,
    SplitComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-layout">
      
      <nav class="nav-rail" role="navigation" aria-label="Menu Principal">
        <div class="nav-logo" aria-hidden="true">PDF</div>
        
        <div class="nav-items" role="tablist">
          <button 
            role="tab"
            [attr.aria-selected]="currentRoute() === 'editor'"
            [class.active]="currentRoute() === 'editor'" 
            (click)="setRoute('editor')"
            title="Editor de PDF"
            aria-label="Ir para o Editor">
            <span class="icon" aria-hidden="true">✏️</span>
            <span class="label">Editor</span>
          </button>
          
          <button 
            role="tab"
            [attr.aria-selected]="currentRoute() === 'merge'"
            [class.active]="currentRoute() === 'merge'" 
            (click)="setRoute('merge')"
            title="Juntar PDFs"
            aria-label="Ir para Juntar PDFs">
            <span class="icon" aria-hidden="true">🔗</span>
            <span class="label">Juntar</span>
          </button>
          
          <button 
            role="tab"
            [attr.aria-selected]="currentRoute() === 'split'"
            [class.active]="currentRoute() === 'split'" 
            (click)="setRoute('split')"
            title="Extrair Páginas"
            aria-label="Ir para Extrair Páginas">
            <span class="icon" aria-hidden="true">✂️</span>
            <span class="label">Extrair</span>
          </button>
        </div>
      </nav>

      <main class="main-content" role="main">
        
        @if (currentRoute() === 'editor') {
          <div class="editor-module">
            <app-toolbar></app-toolbar>

            <div 
              class="workspace"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)">
              
              @if (!pdfState.isFileLoaded()) {
                <div class="dropzone-container">
                  <div class="dropzone" [class.drag-active]="isDragging()">
                    <div class="drop-content">
                      <div class="drop-icon" aria-hidden="true">📄</div>
                      <h2>Arraste o seu PDF aqui para editar</h2>
                      <p class="drop-subtitle">As suas operações são processadas localmente. Nenhum ficheiro é enviado para a internet.</p>
                      
                      <div class="divider-text"><span>ou</span></div>
                      
                      <label for="pdf-upload-input" class="btn-upload">
                        Selecionar Ficheiro do Computador
                        <input id="pdf-upload-input" type="file" accept="application/pdf" (change)="onFileSelected($event)" hidden>
                      </label>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="editor-layout">
                  
                  @if (isSidebarOpenMobile()) {
                    <div class="sidebar-backdrop" (click)="toggleSidebar()"></div>
                  }

                  <app-sidebar 
                    class="sidebar-host"
                    [class.open-mobile]="isSidebarOpenMobile()"
                    (pageSelected)="closeSidebarMobile()">
                  </app-sidebar>
                  
                  <app-viewer class="viewer-area"></app-viewer>

                  <button 
                    class="fab-menu" 
                    (click)="toggleSidebar()" 
                    aria-label="Alternar painel de miniaturas"
                    title="Ver Páginas">
                    📑
                  </button>

                </div>
              }
            </div>
          </div>
        }

        @if (currentRoute() === 'merge') {
          <div class="module-container">
            <app-merge></app-merge>
          </div>
        }

        @if (currentRoute() === 'split') {
          <div class="module-container">
            <app-split></app-split>
          </div>
        }

      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; width: 100vw; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; }
    
    .app-layout { display: flex; height: 100%; background: #f8fafc; overflow: hidden; }
    
    /* NAV RAIL: Layout Desktop */
    .nav-rail {
      width: 80px; background: #1e293b; display: flex; flex-direction: column; 
      align-items: center; padding-top: 24px; border-right: 1px solid #0f172a;
      z-index: 200; /* Deve estar acima da gaveta em Desktop */
      transition: all 0.3s ease; box-shadow: 2px 0 8px rgba(0,0,0,0.1);
    }
    
    .nav-logo {
      color: white; font-weight: 800; font-size: 1.1rem; margin-bottom: 40px;
      background: #2563eb; padding: 10px; border-radius: 10px; letter-spacing: 1px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.4); user-select: none;
    }
    
    .nav-items { display: flex; flex-direction: column; gap: 8px; width: 100%; }
    .nav-items button {
      background: transparent; border: none; color: #94a3b8; cursor: pointer;
      padding: 16px 0; display: flex; flex-direction: column; align-items: center;
      gap: 6px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border-left: 3px solid transparent; border-radius: 0; outline: none;
      user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .nav-items button:hover, .nav-items button:focus-visible { color: white; background: #334155; }
    .nav-items button.active { color: white; border-left-color: #3b82f6; background: #0f172a; }
    
    .icon { font-size: 1.25rem; }
    .label { font-size: 0.75rem; font-weight: 500; }

    /* CORE LAYOUT */
    .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f1f5f9; position: relative; }
    .module-container { flex: 1; overflow-y: auto; padding: 24px; -webkit-overflow-scrolling: touch; }
    .editor-module { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    .workspace { flex: 1; display: flex; position: relative; overflow: hidden; }
    
    .editor-layout { display: flex; flex: 1; width: 100%; height: 100%; overflow: hidden; position: relative; }
    .sidebar-host { display: block; z-index: 100; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .viewer-area { flex: 1; height: 100%; overflow: hidden; min-width: 0; }
    
    /* Escondidos em Desktop por defeito */
    .fab-menu { display: none; } 
    .sidebar-backdrop { display: none; }

    /* DROPZONE PREMIUM */
    .dropzone-container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow-y: auto; }
    .dropzone { 
      width: 100%; max-width: 600px; border: 2px dashed #cbd5e1; border-radius: 16px; 
      background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(8px);
      transition: all 0.3s ease; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 48px 32px;
    }
    .dropzone.drag-active { 
      border-color: #3b82f6; background: rgba(239, 246, 255, 0.9); 
      transform: scale(1.02); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.15); 
    }
    
    .drop-content { text-align: center; color: #475569; display: flex; flex-direction: column; align-items: center; }
    .drop-icon { font-size: 4rem; opacity: 0.8; margin-bottom: 16px; transition: transform 0.3s; }
    .drag-active .drop-icon { transform: translateY(-10px); }
    
    .drop-content h2 { margin: 0 0 12px 0; color: #0f172a; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .drop-subtitle { margin: 0; font-size: 0.95rem; line-height: 1.5; color: #64748b; max-width: 400px; }
    
    .divider-text { 
      width: 100%; display: flex; align-items: center; text-align: center; margin: 32px 0; color: #94a3b8; font-size: 0.85rem; 
    }
    .divider-text::before, .divider-text::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
    .divider-text span { padding: 0 12px; }

    .btn-upload {
      display: inline-block; padding: 14px 28px; background: #2563eb; color: white; 
      border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem;
      transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
    }
    .btn-upload:hover { background: #1d4ed8; box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.4); transform: translateY(-1px); }
    .btn-upload:active { transform: translateY(0); }

    /* RESPONSIVIDADE MOBILE (Bottom Navigation Bar & Drawer Sidebar) */
    @media (max-width: 768px) {
      .app-layout { flex-direction: column; }
      
      .nav-rail {
        width: 100%; height: 72px; flex-direction: row; padding: 0; 
        border-right: none; border-top: 1px solid #0f172a; 
        justify-content: space-around; box-shadow: 0 -4px 6px rgba(0,0,0,0.1);
        padding-bottom: env(safe-area-inset-bottom);
        z-index: 50; /* A gaveta das miniaturas sobrepõe a tab bar se necessário */
      }
      
      .nav-logo { display: none; }
      
      .nav-items { flex-direction: row; height: 100%; justify-content: center; gap: 0; }
      .nav-items button { 
        padding: 8px 4px; border-left: none; border-top: 3px solid transparent; 
        flex: 1; max-width: 120px; justify-content: center;
      }
      .nav-items button.active { border-left-color: transparent; border-top-color: #3b82f6; background: #0f172a; }
      
      .editor-layout { flex-direction: column; position: relative; }
      
      /* A Sidebar transforma-se numa Gaveta Oculta (Drawer) */
      .sidebar-host {
        position: absolute; top: 0; left: 0; height: 100%; 
        transform: translateX(-100%); /* Escondida fora do ecrã */
        box-shadow: 4px 0 15px rgba(0,0,0,0.15); z-index: 100;
      }
      .sidebar-host.open-mobile { transform: translateX(0); } /* Revela a gaveta via classe */

      /* Backdrop Escuro (Foco e Fecho rápido) */
      .sidebar-backdrop {
        display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.6); z-index: 90; backdrop-filter: blur(2px);
        animation: fadeIn 0.3s; cursor: pointer;
      }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

      /* Botão FAB para invocar a gaveta */
      .fab-menu {
        display: flex; position: absolute; top: 16px; left: 16px; z-index: 40;
        width: 44px; height: 44px; border-radius: 50%; background: #ffffff;
        border: 1px solid #e2e8f0; align-items: center; justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); cursor: pointer; font-size: 1.3rem;
        user-select: none; -webkit-tap-highlight-color: transparent;
      }
      .fab-menu:active { background: #f1f5f9; transform: scale(0.95); }
    }
  `]
})
export class AppComponent {
  public readonly pdfState: PdfStateService = inject(PdfStateService);
  
  public currentRoute: WritableSignal<AppRoute> = signal<AppRoute>('editor');
  public isDragging: WritableSignal<boolean> = signal<boolean>(false);
  
  // OTIMIZAÇÃO MOBILE: Sinal que controla o estado aberto/fechado da gaveta lateral
  public isSidebarOpenMobile: WritableSignal<boolean> = signal<boolean>(false);

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  setRoute(route: AppRoute): void {
    this.currentRoute.set(route);
    this.isSidebarOpenMobile.set(false); // Fecha a gaveta se trocar de rota
  }

  // ==========================================================================
  // GESTÃO DA GAVETA MOBILE (DRAWER)
  // ==========================================================================
  toggleSidebar(): void {
    this.isSidebarOpenMobile.update(state => !state);
  }

  closeSidebarMobile(): void {
    this.isSidebarOpenMobile.set(false);
  }

  // ==========================================================================
  // GESTÃO DE DRAG & DROP DO WORKSPACE
  // ==========================================================================
  onDragOver(event: DragEvent): void {
    event.preventDefault(); 
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault(); 
    event.stopPropagation();
    if (event.relatedTarget === null) {
      this.isDragging.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault(); 
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files[0];
    if (file && file.type === 'application/pdf') {
      this.processFile(file);
    } else {
      alert('Formato inválido. Por favor, arraste apenas ficheiros PDF.');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && file.type === 'application/pdf') {
      this.processFile(file);
    }
    input.value = ''; 
  }

  private async processFile(file: File): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfState.loadDocument(arrayBuffer);
    } catch (error) {
      alert('Não foi possível ler o ficheiro local. O ficheiro pode estar corrompido.');
      console.error('[App] Erro ao carregar ArrayBuffer:', error);
    }
  }
}