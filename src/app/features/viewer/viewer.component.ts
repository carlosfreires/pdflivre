import { 
  Component, 
  ChangeDetectionStrategy, 
  inject, 
  ViewChild, 
  ElementRef, 
  effect, 
  OnDestroy,
  HostListener,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfStateService } from '../../shared/services/pdf-state.service';
import { PdfRenderService } from '../../shared/services/pdf-render.service';
import { EditorOverlayComponent } from '../editor/editor-overlay.component';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, EditorOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer-container">
      
      <div class="canvas-wrapper">
        
        @if (!isEngineReady()) {
          <div class="engine-loader">
            <div class="spinner"></div>
            <span>A processar documento...</span>
          </div>
        }

        <div class="render-box" [class.is-ready]="isEngineReady()">
          <canvas #pdfCanvas aria-label="Visualizador de PDF" role="img"></canvas>
          <app-editor-overlay></app-editor-overlay>
        </div>
      </div>

      <div class="floating-controls" role="toolbar" aria-label="Controlos de visualização">
        <button 
          (click)="previousPage()" 
          [disabled]="pdfState.currentPage() <= 1 || !isEngineReady()"
          aria-label="Página Anterior"
          title="Anterior (Seta Esquerda)">
          ◀
        </button>
        
        <span class="page-info" aria-live="polite">
          {{ pdfState.currentPage() }} / {{ pdfState.totalPages() }}
        </span>
        
        <button 
          (click)="nextPage()" 
          [disabled]="pdfState.currentPage() >= pdfState.totalPages() || !isEngineReady()"
          aria-label="Página Seguinte"
          title="Seguinte (Seta Direita)">
          ▶
        </button>
        
        <div class="control-divider" aria-hidden="true"></div>
        
        <button 
          (click)="zoomOut()" 
          [disabled]="pdfState.zoomLevel() <= 0.5 || !isEngineReady()"
          aria-label="Reduzir Zoom"
          title="Menos Zoom (Tecla -)">
          −
        </button>
        
        <span class="zoom-info" aria-live="polite">
          {{ (pdfState.zoomLevel() * 100) | number:'1.0-0' }}%
        </span>
        
        <button 
          (click)="zoomIn()" 
          [disabled]="pdfState.zoomLevel() >= 3.0 || !isEngineReady()"
          aria-label="Aumentar Zoom"
          title="Mais Zoom (Tecla +)">
          +
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { 
      display: flex; flex-direction: column; flex: 1; 
      width: 100%; height: 100%; min-height: 0; min-width: 0; 
      overflow: hidden; 
    }

    .viewer-container {
      position: relative; display: flex; flex-direction: column; flex: 1;
      align-items: center; width: 100%; height: 100%; min-height: 0;
      background: #e2e8f0;
    }
    
    /* OTIMIZAÇÃO ARCH: Troca de Flexbox por CSS Grid para resolver o bug crónico de corte 
       de margens quando os elementos filhos dão overflow (Zoom in Mobile) */
    .canvas-wrapper {
      width: 100%; height: 100%; display: grid; 
      place-items: start center; /* Centra horizontalmente, cola no topo verticalmente */
      padding: 32px 24px 100px 24px; box-sizing: border-box;
      overflow: auto;
      scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
      will-change: scroll-position;
    }

    .canvas-wrapper::-webkit-scrollbar { width: 8px; height: 8px; }
    .canvas-wrapper::-webkit-scrollbar-track { background: transparent; }
    .canvas-wrapper::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 10px; }
    .canvas-wrapper::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.8); }

    .render-box {
      position: relative; display: grid; /* Mantém o formato fluido de blocos */
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0,0,0,0.2);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
      opacity: 0.4; /* Opacidade inicial até a engine avisar que renderizou */
      filter: blur(2px);
      will-change: transform, opacity, filter; /* Hint para alocação da GPU */
    }
    .render-box.is-ready {
      opacity: 1; filter: blur(0);
    }

    canvas { display: block; background: #ffffff; border-radius: 2px; }

    /* Indicador Visual (UX) da Engine */
    .engine-loader {
      position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%);
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      color: #3b82f6; font-weight: 600; font-size: 0.95rem; z-index: 10;
    }
    .spinner {
      width: 32px; height: 32px; border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6; border-radius: 50%;
      animation: spin 1s infinite linear;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .floating-controls {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px; 
      background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      padding: 8px 12px; border-radius: 100px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08); 
      border: 1px solid rgba(255,255,255,0.4); z-index: 50;
    }

    .floating-controls button {
      padding: 8px 12px; border: none; background: transparent; color: #334155;
      border-radius: 100px; cursor: pointer; font-size: 1rem; font-weight: 600;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); outline: none;
      display: flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px;
      user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .floating-controls button:hover:not(:disabled), .floating-controls button:focus-visible:not(:disabled) { 
      background: rgba(59, 130, 246, 0.1); color: #2563eb; 
    }
    .floating-controls button:focus-visible { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3b82f6; }
    .floating-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
    
    .page-info, .zoom-info { 
      font-size: 0.9rem; font-weight: 600; color: #1e293b; 
      min-width: 60px; text-align: center; user-select: none; font-variant-numeric: tabular-nums;
    }
    .control-divider { width: 1px; height: 24px; background: #cbd5e1; margin: 0 6px; }

    @media (max-width: 600px) {
      .canvas-wrapper { padding-top: 72px; /* Deixa espaço livre para o botão flutuante das miniaturas */ }
      .floating-controls { width: 90%; max-width: 360px; justify-content: space-between; bottom: 16px; padding: 6px 8px; }
      .page-info { font-size: 0.85rem; min-width: auto; }
      .zoom-info { display: none; }
    }
  `]
})
export class ViewerComponent implements OnDestroy {
  public readonly pdfState = inject(PdfStateService);
  private readonly pdfRender = inject(PdfRenderService);

  @ViewChild('pdfCanvas', { static: true }) 
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Sinal Crítico: Garante que nunca tentamos pintar no Canvas antes do Motor WebGL terminar o Parsing.
  public isEngineReady = signal(false);

  constructor() {
    // EFEITO 1: Motor Físico (Parsing & Loading)
    effect(async () => {
      const buffer = this.pdfState.getCurrentBuffer();
      // Registamos a versão de forma reativa. Se rodar ou apagar página, isto aciona de novo.
      const version = this.pdfState.documentVersion(); 

      if (buffer) {
        // Tranca a UI impedindo renderizações prematuras (Race Condition fix)
        this.isEngineReady.set(false); 
        try {
          const totalPages = await this.pdfRender.loadDocument(buffer);
          this.pdfState.totalPages.set(totalPages);
          this.isEngineReady.set(true); // Destranca a UI
        } catch (error) {
          console.error('[Viewer] Falha catastrófica ao carregar a estrutura do PDF:', error);
        }
      }
    }, { allowSignalWrites: true }); 

    // EFEITO 2: Motor Visual (Pintura no Canvas)
    effect(async () => {
      const page = this.pdfState.currentPage();
      const zoom = this.pdfState.zoomLevel();
      const isReady = this.isEngineReady(); 

      // Só ordena a pintura se o Worker confirmou a prontidão
      if (isReady && this.canvasRef) {
        await this.triggerRender(page, zoom);
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardNavigation(event: KeyboardEvent): void {
    const activeEl = document.activeElement as HTMLElement;
    
    // OTIMIZAÇÃO A11Y: Verifica não só inputs nativos mas elementos contenteditable
    const isEditingText = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable;
    if (isEditingText) return;

    if (!this.isEngineReady()) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault(); 
        this.nextPage();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        this.previousPage();
        break;
      case '+':
      case '=':
        this.zoomIn();
        break;
      case '-':
      case '_':
        this.zoomOut();
        break;
    }
  }

  ngOnDestroy(): void {
    // Limpeza profunda na memória da RAM / Placa Gráfica 
    this.pdfRender.unloadDocument();
  }

  nextPage(): void {
    if (this.pdfState.currentPage() < this.pdfState.totalPages()) {
      this.pdfState.currentPage.update(p => p + 1);
    }
  }

  previousPage(): void {
    if (this.pdfState.currentPage() > 1) {
      this.pdfState.currentPage.update(p => p - 1);
    }
  }

  zoomIn(): void {
    if (this.pdfState.zoomLevel() < 3.0) {
      this.pdfState.zoomLevel.update(z => Math.min(Math.round((z + 0.25) * 100) / 100, 3.0));
    }
  }

  zoomOut(): void {
    if (this.pdfState.zoomLevel() > 0.5) {
      this.pdfState.zoomLevel.update(z => Math.max(Math.round((z - 0.25) * 100) / 100, 0.5));
    }
  }

  private async triggerRender(page: number, zoom: number): Promise<void> {
    try {
      // isPriority = true (fura a fila do Worker para debouncing imediato do Canvas central)
      await this.pdfRender.renderPage(page, this.canvasRef.nativeElement, zoom, true);
    } catch (error) {
      console.warn('[Viewer] Pintura interrompida intencionalmente por uma nova navegação rápida.', error);
    }
  }
}