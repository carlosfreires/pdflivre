import { 
  Component, 
  ChangeDetectionStrategy, 
  inject, 
  Input, 
  ViewChild, 
  ElementRef, 
  OnInit, 
  computed,
  signal,
  Output,
  EventEmitter,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfStateService } from '../services/pdf-state.service';
import { PdfRenderService } from '../services/pdf-render.service';
import { PdfMutateService } from '../services/pdf-mutate.service';

// ============================================================================
// SUB-COMPONENTE: MINIATURA INDIVIDUAL (Isolado para Virtualização)
// ============================================================================
@Component({
  selector: 'app-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #thumbCanvas aria-hidden="true"></canvas>`,
  styles: [`
    :host { 
      display: flex; width: 100%; justify-content: center; align-items: center;
      /* Impede interações fantasmas no canvas durante o scroll fluido */
      pointer-events: none; min-height: 180px; 
    }
    canvas { 
      width: 100%; height: auto; max-width: 160px; background: white; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px;
      transition: opacity 0.3s ease-in;
    }
  `]
})
export class ThumbnailComponent implements OnInit {
  @Input({ required: true }) pageNumber!: number;
  @ViewChild('thumbCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private readonly pdfRender = inject(PdfRenderService);

  async ngOnInit(): Promise<void> {
    // A escala 0.2 gera uma miniatura ultra-leve para a fila de background
    await this.pdfRender.renderPage(this.pageNumber, this.canvasRef.nativeElement, 0.2);
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL: BARRA LATERAL (Navegação e Ordenação)
// ============================================================================
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, ThumbnailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar-container" [class.is-processing]="isProcessing()">
      <div class="sidebar-header">
        <h3>Páginas</h3>
        <span class="badge" aria-label="Total de páginas">{{ pdfState.totalPages() }}</span>
      </div>
      
      <div class="thumbnails-list" role="list">
        @for (page of pagesArray(); track page) {
          
          <div 
            class="thumbnail-wrapper" 
            role="button"
            tabindex="0"
            [attr.aria-label]="'Ir para a página ' + page"
            [class.active]="pdfState.currentPage() === page"
            (click)="goToPage(page)"
            (keydown.enter)="goToPage(page)"
            (keydown.space)="goToPage(page); $event.preventDefault()">
            
            <div class="page-number" aria-hidden="true">{{ page }}</div>

            <div class="page-controls" (click)="$event.stopPropagation()">
              <button 
                (click)="movePageUp(page)" 
                [disabled]="page === 1 || isProcessing()" 
                aria-label="Mover página para cima"
                title="Mover para cima">
                ▲
              </button>
              
              <button 
                (click)="movePageDown(page)" 
                [disabled]="page === pdfState.totalPages() || isProcessing()" 
                aria-label="Mover página para baixo"
                title="Mover para baixo">
                ▼
              </button>
            </div>
            
            @defer (on viewport) {
              <app-thumbnail [pageNumber]="page"></app-thumbnail>
            } @placeholder {
              <div class="thumbnail-placeholder">
                <div class="skeleton-shimmer"></div>
              </div>
            }
            
          </div>
        }
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .sidebar-container { 
      display: flex; flex-direction: column; width: 240px; height: 100%; 
      background: #f8fafc; border-right: 1px solid #e2e8f0; transition: opacity 0.2s;
    }
    
    .sidebar-container.is-processing { opacity: 0.7; pointer-events: none; }

    .sidebar-header { 
      padding: 16px 20px; border-bottom: 1px solid #e2e8f0; 
      display: flex; justify-content: space-between; align-items: center; background: #ffffff; 
      box-shadow: 0 1px 2px rgba(0,0,0,0.02); z-index: 10;
    }
    .sidebar-header h3 { margin: 0; font-size: 0.9rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge { background: #e2e8f0; color: #334155; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }
    
    .thumbnails-list { 
      flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px 16px; 
      display: flex; flex-direction: column; gap: 24px; 
      scroll-behavior: smooth;
    }

    /* OTIMIZAÇÃO UX: Scrollbars modernas */
    .thumbnails-list::-webkit-scrollbar { width: 6px; }
    .thumbnails-list::-webkit-scrollbar-track { background: transparent; }
    .thumbnails-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .thumbnails-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    .thumbnail-wrapper {
      position: relative; padding: 12px; border: 2px solid transparent;
      border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
      background: #f1f5f9; outline: none; min-height: 200px; display: flex; align-items: center;
    }
    .thumbnail-wrapper:hover, .thumbnail-wrapper:focus-visible { border-color: #94a3b8; background: #e2e8f0; }
    
    .thumbnail-wrapper.active { 
      border-color: #3b82f6; background: #eff6ff; 
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    }

    .page-number {
      position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: white; font-size: 0.75rem; padding: 4px 12px;
      border-radius: 12px; z-index: 10; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }

    .page-controls {
      position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px;
      opacity: 0; transition: opacity 0.2s; z-index: 20;
    }
    
    /* Dispositivos com Rato: Mostra no hover/focus */
    .thumbnail-wrapper:hover .page-controls,
    .thumbnail-wrapper:focus-visible .page-controls { opacity: 1; }
    
    .page-controls button {
      background: rgba(255, 255, 255, 0.95); border: 1px solid #cbd5e1; border-radius: 6px;
      width: 28px; height: 28px; font-size: 10px; cursor: pointer; display: flex;
      align-items: center; justify-content: center; color: #334155; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.15s; outline: none;
    }
    .page-controls button:hover:not(:disabled), .page-controls button:focus-visible:not(:disabled) { 
      background: #f8fafc; color: #2563eb; border-color: #93c5fd; transform: scale(1.05);
    }
    .page-controls button:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Skeleton Loader para as miniaturas que ainda não carregaram */
    .thumbnail-placeholder {
      width: 100%; height: 180px; background: #e2e8f0; border-radius: 4px; overflow: hidden; position: relative;
    }
    .skeleton-shimmer {
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

    /* OTIMIZAÇÃO UX MOBILE: Ajustes para ecrãs touch e Gaveta */
    @media (max-width: 768px) {
      .sidebar-container { width: 280px; } /* Mais largo para polegares */
      .page-controls { opacity: 1; flex-direction: row; top: auto; bottom: 8px; right: 8px; }
      .page-controls button { width: 36px; height: 36px; font-size: 12px; }
      .thumbnail-wrapper { padding-bottom: 40px; } /* Dá espaço para os botões no fundo */
    }
  `]
})
export class SidebarComponent {
  // OTIMIZAÇÃO: Tipagem Pública Estrita (Resolve Erros TS no Template)
  public readonly pdfState = inject(PdfStateService);
  private readonly pdfMutate = inject(PdfMutateService);
  private readonly elRef = inject(ElementRef);

  // OTIMIZAÇÃO MOBILE: Emite evento sempre que uma miniatura é clicada para que o App Component feche a gaveta
  @Output() pageSelected = new EventEmitter<number>();

  public isProcessing = signal(false);

  public readonly pagesArray = computed(() => {
    const total = this.pdfState.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  constructor() {
    // OTIMIZAÇÃO UX (Auto-Scroll): 
    // Quando a página atual muda (ex: através do botão 'Próxima' no Viewer), 
    // a barra lateral faz scroll automaticamente para garantir que a miniatura ativa está visível.
    effect(() => {
      const currentPage = this.pdfState.currentPage();
      
      // Um pequeno setTimeout permite que a view do Angular atualize a class '.active' antes de tentarmos encontrá-la
      setTimeout(() => {
        const activeThumbnail = this.elRef.nativeElement.querySelector('.thumbnail-wrapper.active');
        if (activeThumbnail) {
          activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    });
  }

  goToPage(pageNumber: number): void {
    if (!this.isProcessing()) {
      this.pdfState.currentPage.set(pageNumber);
      this.pageSelected.emit(pageNumber);
    }
  }

  async movePageUp(pageNumber: number): Promise<void> {
    if (pageNumber <= 1 || this.isProcessing()) return;
    await this.performMove(pageNumber, pageNumber - 1);
  }

  async movePageDown(pageNumber: number): Promise<void> {
    if (pageNumber >= this.pdfState.totalPages() || this.isProcessing()) return;
    await this.performMove(pageNumber, pageNumber + 1);
  }

  private async performMove(fromPage: number, toPage: number): Promise<void> {
    const buffer = this.pdfState.getCurrentBuffer();
    if (!buffer) return;

    this.isProcessing.set(true);
    try {
      const fromIndex = fromPage - 1;
      const toIndex = toPage - 1;
      
      const newBuffer = await this.pdfMutate.movePage(buffer, fromIndex, toIndex);
      
      // Atualiza o documento estruturalmente
      this.pdfState.updateDocument(newBuffer);
      
      // UX: Acompanha o documento se mover a página que está aberta
      if (this.pdfState.currentPage() === fromPage) {
        this.pdfState.currentPage.set(toPage);
      } else if (this.pdfState.currentPage() === toPage) {
        this.pdfState.currentPage.set(fromPage);
      }

    } catch (error) {
      console.error('[Sidebar] Erro ao reordenar a página:', error);
      alert('Ocorreu um erro ao tentar reordenar o documento.');
    } finally {
      this.isProcessing.set(false);
    }
  }
}