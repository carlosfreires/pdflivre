import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfStateService, EditorTool } from '../services/pdf-state.service';
import { PdfMutateService, PdfAnnotation } from '../services/pdf-mutate.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="toolbar">
      <div class="brand" aria-hidden="true">PDF Livre</div>
      
      <div class="tools" role="toolbar" aria-label="Ferramentas de Edição de PDF">
        
        @if (pdfState.isFileLoaded()) {
          
          <label 
            class="btn-tool btn-open" 
            [class.disabled]="isProcessing()"
            title="Carregar e substituir por um novo documento PDF">
            Abrir PDF
            <input 
              type="file" 
              accept="application/pdf" 
              (change)="onOpenDocument($event)" 
              [disabled]="isProcessing()"
              aria-hidden="true"
              hidden>
          </label>

          <div class="divider" aria-hidden="true"></div>
          
          <button 
            (click)="setTool('pan')" 
            [class.active]="pdfState.activeTool() === 'pan'" 
            [disabled]="isProcessing()"
            title="Mover e navegar pelo documento"
            aria-label="Ferramenta de navegação">
            Mover
          </button>
          
          <button 
            (click)="setTool('text')" 
            [class.active]="pdfState.activeTool() === 'text'" 
            [disabled]="isProcessing()"
            title="Adicionar novo texto"
            aria-label="Ferramenta de texto">
            Texto
          </button>
          
          <label 
            class="btn-tool" 
            [class.active]="pdfState.activeTool() === 'image'"
            [class.disabled]="isProcessing()"
            title="Inserir uma imagem">
            Imagem
            <input 
              type="file" 
              accept="image/png, image/jpeg" 
              (change)="onImageSelected($event)" 
              [disabled]="isProcessing()"
              hidden>
          </label>
          
          <button 
            (click)="setTool('signature')" 
            [class.active]="pdfState.activeTool() === 'signature'" 
            [disabled]="isProcessing()"
            title="Desenhar e inserir assinatura"
            aria-label="Ferramenta de assinatura">
            Assinar
          </button>

          <button 
            (click)="setTool('whiteout')" 
            [class.active]="pdfState.activeTool() === 'whiteout'" 
            [disabled]="isProcessing()"
            title="Cobrir conteúdo com tarja branca"
            aria-label="Ferramenta de ocultar">
            Ocultar
          </button>
          
          <div class="divider" aria-hidden="true"></div>
          
          <button 
            class="danger" 
            (click)="deleteCurrentPage()" 
            [disabled]="isProcessing() || pdfState.totalPages() <= 1"
            title="Remover a página atual"
            aria-label="Excluir página">
            Excluir Página
          </button>
          
          <button 
            (click)="rotateCurrentPage()" 
            [disabled]="isProcessing()"
            title="Rodar a página 90 graus"
            aria-label="Rotacionar página">
            Rotacionar
          </button>
          
          <button 
            class="primary" 
            (click)="saveDocument()" 
            [disabled]="isProcessing()"
            title="Aplicar edições e baixar o PDF">
            {{ isProcessing() ? 'Processando...' : 'Salvar PDF' }}
          </button>
          
          <div class="divider" aria-hidden="true"></div>
          
          <button 
            class="danger-outline" 
            (click)="closeDocument()" 
            [disabled]="isProcessing()"
            title="Fechar o documento sem salvar"
            aria-label="Fechar documento">
            Fechar
          </button>
        }
      </div>
    </header>
  `,
  styles: [`
    .toolbar { 
      height: 64px; background: #ffffff; border-bottom: 1px solid #e2e8f0; 
      display: flex; align-items: center; padding: 0 16px; justify-content: space-between; 
      width: 100%; box-sizing: border-box; z-index: 50;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    
    .brand { 
      font-weight: 800; font-size: 1.1rem; color: #0f172a; 
      margin-right: 24px; letter-spacing: -0.02em; flex-shrink: 0;
    }
    
    .tools { 
      display: flex; gap: 8px; align-items: center; flex: 1;
      overflow-x: auto; scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .tools::-webkit-scrollbar { display: none; }
    
    button, .btn-tool { 
      flex-shrink: 0; padding: 8px 14px; border: 1px solid transparent; background: transparent; 
      border-radius: 6px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
      font-size: 0.9rem; color: #334155; font-weight: 500;
      display: inline-flex; align-items: center; justify-content: center; 
      font-family: inherit; user-select: none; outline: none;
    }
    
    button:hover:not(:disabled), .btn-tool:hover:not(.disabled) { background: #f1f5f9; color: #0f172a; }
    button:focus-visible, .btn-tool:focus-visible { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3b82f6; }
    button:disabled, .btn-tool.disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
    
    .btn-open { border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a; }
    
    .active { background: #e0e7ff !important; color: #1d4ed8 !important; }
    
    .primary { background: #2563eb; color: white; font-weight: 600; box-shadow: 0 1px 2px rgba(37,99,235,0.3); }
    .primary:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.4); }
    
    .danger { color: #dc2626; }
    .danger:hover:not(:disabled) { background: #fef2f2; }
    
    .danger-outline { color: #dc2626; border-color: #fecaca; }
    .danger-outline:hover:not(:disabled) { background: #fef2f2; }
    
    .divider { width: 1px; height: 28px; background: #e2e8f0; margin: 0 4px; flex-shrink: 0; }
  `]
})
export class ToolbarComponent {
  public readonly pdfState = inject(PdfStateService);
  private readonly pdfMutate = inject(PdfMutateService);

  public isProcessing = signal(false);

  setTool(tool: EditorTool): void {
    this.pdfState.activeTool.set(tool);
  }

  /**
   * Abre um novo documento, substituindo o atual em memória.
   * OTIMIZADO: Utiliza a mesma API Promise-based do AppComponent.
   */
  async onOpenDocument(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file && file.type === 'application/pdf') {
      this.isProcessing.set(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        this.pdfState.loadDocument(arrayBuffer);
      } catch (error) {
        alert('Ocorreu um erro ao ler o ficheiro localmente.');
        console.error('[Toolbar] Erro ao carregar ArrayBuffer:', error);
      } finally {
        this.isProcessing.set(false);
      }
    }
    input.value = ''; 
  }

  /**
   * Lida com a seleção e injeção de imagens genéricas no Canvas.
   * OTIMIZADO: Remoção do Callback Hell. Transformado em operação assíncrona limpa.
   */
  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      this.isProcessing.set(true);
      try {
        const dataUrl = await this.readFileAsDataURL(file);
        
        const newImg: PdfAnnotation = {
          id: crypto.randomUUID(),
          type: 'image',
          x: 0.1, 
          y: 0.1,
          dataUrl: dataUrl,
          width: 0.3,
          height: 0.2
        };
        
        this.pdfState.updatePageAnnotations(arr => [...arr, newImg]);
        this.pdfState.activeTool.set('pan');

      } catch (error) {
        alert('Erro ao processar a imagem.');
      } finally {
        this.isProcessing.set(false);
      }
    }
    input.value = ''; 
  }

  /**
   * Utilitário privado para converter um File em Base64 (DataURL) via Promise.
   */
  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  closeDocument(): void {
    if (confirm('Deseja realmente fechar? As alterações não salvas serão perdidas.')) {
      this.pdfState.closeDocument();
    }
  }

  async saveDocument(): Promise<void> {
    let buffer = this.pdfState.getCurrentBuffer();
    if (!buffer) return;

    this.isProcessing.set(true);
    try {
      const allAnnotations = this.pdfState.documentAnnotations();
      const hasAnnotations = Object.values(allAnnotations).some(arr => arr.length > 0);
      
      if (hasAnnotations) {
        buffer = await this.pdfMutate.applyAnnotations(buffer, allAnnotations);
        this.pdfState.updateDocument(buffer); 
      }

      this.pdfMutate.saveDocumentLocally(buffer, 'documento-editado.pdf');

    } catch (error) {
      alert('Não foi possível salvar o documento. Tente novamente.');
      console.error('[Toolbar] Erro ao salvar:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async rotateCurrentPage(): Promise<void> {
    const buffer = this.pdfState.getCurrentBuffer();
    if (!buffer) return;

    this.isProcessing.set(true);
    try {
      const pageIndex = this.pdfState.currentPage() - 1;
      const newBuffer = await this.pdfMutate.rotatePage(buffer, pageIndex, 90);
      this.pdfState.updateDocument(newBuffer);
    } catch (error) {
      alert('Não foi possível rotacionar a página.');
      console.error('[Toolbar] Erro ao rotacionar:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async deleteCurrentPage(): Promise<void> {
    const buffer = this.pdfState.getCurrentBuffer();
    if (!buffer) return;
    
    if (!confirm(`Deseja mesmo excluir permanentemente a página ${this.pdfState.currentPage()}?`)) return;

    this.isProcessing.set(true);
    try {
      const pageIndex = this.pdfState.currentPage() - 1;
      const newBuffer = await this.pdfMutate.deletePage(buffer, pageIndex);
      this.pdfState.updateDocument(newBuffer, this.pdfState.totalPages() - 1);
    } catch (error) {
      alert('Não foi possível excluir a página.');
      console.error('[Toolbar] Erro ao excluir:', error);
    } finally {
      this.isProcessing.set(false);
    }
  }
}