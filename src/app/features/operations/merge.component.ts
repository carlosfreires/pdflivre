import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfMutateService } from '../../shared/services/pdf-mutate.service';

@Component({
  selector: 'app-merge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="merge-container">
      <h2>Juntar PDFs</h2>
      <p class="subtitle">Selecione vários ficheiros e ordene-os antes de juntar.</p>

      <div 
        class="upload-area dropzone" 
        [class.drag-active]="isDragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)">
        
        <div class="drop-content">
          <p class="drop-hint">Arraste os seus PDFs aqui</p>
          <span class="drop-or">ou</span>
          <label class="btn-upload" [class.disabled]="isProcessing()">
            Selecionar Ficheiros
            <input 
              type="file" 
              accept="application/pdf" 
              multiple 
              (change)="onFilesSelected($event)" 
              [disabled]="isProcessing()"
              hidden>
          </label>
        </div>
      </div>

      @if (files().length > 0) {
        <div class="file-list" role="list">
          @for (file of files(); track file.name; let i = $index) {
            <div class="file-item" role="listitem">
              <div class="file-info">
                <span class="file-index">{{ i + 1 }}.</span>
                <span class="file-name" [title]="file.name">{{ file.name }}</span>
              </div>
              
              <div class="actions">
                <button 
                  (click)="moveUp(i)" 
                  [disabled]="i === 0 || isProcessing()" 
                  aria-label="Mover ficheiro para cima"
                  title="Mover para cima">
                  ▲
                </button>
                <button 
                  (click)="moveDown(i)" 
                  [disabled]="i === files().length - 1 || isProcessing()" 
                  aria-label="Mover ficheiro para baixo"
                  title="Mover para baixo">
                  ▼
                </button>
                <button 
                  class="btn-delete" 
                  (click)="removeFile(i)" 
                  [disabled]="isProcessing()"
                  aria-label="Remover ficheiro da lista"
                  title="Remover ficheiro">
                  ✕
                </button>
              </div>
            </div>
          }
        </div>

        <button 
          class="btn-primary" 
          (click)="processMerge()" 
          [disabled]="isProcessing() || files().length < 2">
          {{ isProcessing() ? 'A processar união...' : 'Juntar ' + files().length + ' PDFs e Transferir' }}
        </button>
      } @else {
        <div class="empty-state">Nenhum ficheiro selecionado. Adicione pelo menos dois PDFs para começar.</div>
      }
    </div>
  `,
  styles: [`
    .merge-container {
      max-width: 650px; margin: 40px auto; padding: 32px;
      background: #ffffff; border-radius: 16px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    h2 { margin: 0 0 8px 0; color: #0f172a; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .subtitle { color: #64748b; margin-top: 0; margin-bottom: 28px; font-size: 0.95rem; }

    /* Estilização da Dropzone */
    .dropzone { 
      border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;
      padding: 32px 24px; transition: all 0.2s ease-in-out; margin-bottom: 28px;
    }
    .dropzone.drag-active { border-color: #3b82f6; background: #eff6ff; }
    .drop-content { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
    .drop-hint { font-weight: 500; color: #475569; margin: 0; }
    .drop-or { font-size: 0.85rem; color: #94a3b8; }
    
    .btn-upload {
      display: inline-block; padding: 10px 20px; background: #ffffff; border: 1px solid #cbd5e1;
      border-radius: 6px; color: #0f172a; font-weight: 500; cursor: pointer;
      transition: all 0.2s; font-size: 0.95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .btn-upload:hover:not(.disabled) { border-color: #94a3b8; background: #f1f5f9; }
    .btn-upload.disabled { opacity: 0.5; cursor: not-allowed; }

    .file-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    
    .file-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #ffffff; border-radius: 8px;
      border: 1px solid #e2e8f0; transition: border-color 0.2s;
    }
    .file-item:hover { border-color: #cbd5e1; }
    
    /* Layout Responsivo para o texto do ficheiro */
    .file-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; padding-right: 16px; }
    .file-index { color: #64748b; font-weight: 600; font-size: 0.9rem; flex-shrink: 0; }
    .file-name {
      font-size: 0.95rem; color: #334155; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    
    /* Área de Touch Otimizada (32x32px mínimo) */
    .actions { display: flex; gap: 6px; flex-shrink: 0; }
    .actions button {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #475569; font-size: 0.8rem; transition: all 0.15s; outline: none;
    }
    .actions button:focus-visible { box-shadow: 0 0 0 2px #fff, 0 0 0 2px #3b82f6; }
    .actions button:disabled { opacity: 0.3; cursor: not-allowed; }
    .actions button:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
    
    .actions .btn-delete { color: #dc2626; font-size: 1rem; }
    .actions .btn-delete:hover:not(:disabled) { background: #fef2f2; border-color: #fca5a5; }

    .btn-primary {
      width: 100%; padding: 16px; background: #2563eb; color: white;
      border: none; border-radius: 8px; font-size: 1.05rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.3); transform: translateY(-1px); }
    .btn-primary:active:not(:disabled) { transform: translateY(0); }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; transform: none; }
    
    .empty-state { 
      text-align: center; color: #64748b; padding: 32px; 
      border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 0.95rem; background: #f8fafc;
    }
    
    /* Media Queries para Mobile */
    @media (max-width: 600px) {
      .merge-container { margin: 16px; padding: 20px; }
      .actions button { width: 36px; height: 36px; /* Touch area ainda maior */ }
    }
  `]
})
export class MergeComponent {
  private readonly pdfMutate = inject(PdfMutateService);

  files = signal<File[]>([]);
  isProcessing = signal(false);
  
  // Estado local para UI do Drag & Drop
  isDragging = signal(false);

  // ==========================================================================
  // GESTÃO DE ARQUIVOS (DRAG & DROP E INPUT)
  // ==========================================================================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isProcessing()) {
      this.isDragging.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.isProcessing()) return;

    if (event.dataTransfer?.files) {
      this.processNewFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processNewFiles(Array.from(input.files));
    }
    input.value = ''; // Permite re-selecionar o mesmo ficheiro
  }

  private processNewFiles(incomingFiles: File[]): void {
    const validPdfs = incomingFiles.filter(f => f.type === 'application/pdf');
    if (validPdfs.length > 0) {
      this.files.update(current => [...current, ...validPdfs]);
    } else {
      alert('Por favor, adicione apenas ficheiros no formato PDF.');
    }
  }

  // ==========================================================================
  // MANIPULAÇÃO DA LISTA
  // ==========================================================================

  moveUp(index: number): void {
    if (index === 0 || this.isProcessing()) return;
    this.files.update(current => {
      const arr = [...current];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  }

  moveDown(index: number): void {
    if (index === this.files().length - 1 || this.isProcessing()) return;
    this.files.update(current => {
      const arr = [...current];
      [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
      return arr;
    });
  }

  removeFile(index: number): void {
    if (this.isProcessing()) return;
    this.files.update(current => current.filter((_, i) => i !== index));
  }

  // ==========================================================================
  // PROCESSAMENTO CORE
  // ==========================================================================

  async processMerge(): Promise<void> {
    const currentFiles = this.files();
    if (currentFiles.length < 2) return;

    this.isProcessing.set(true);
    try {
      // Otimização I/O: Lê todos os buffers em paralelo em vez de sequencial
      const bufferPromises = currentFiles.map(file => file.arrayBuffer());
      const buffers = await Promise.all(bufferPromises);

      // Delega a mutação pesada ao Web Worker
      const mergedBuffer = await this.pdfMutate.mergePdfs(buffers);
      
      // Exporta e limpa a tela para a próxima operação
      this.pdfMutate.saveDocumentLocally(mergedBuffer, 'documentos-juntos.pdf');
      this.files.set([]);

    } catch (error) {
      console.error('[MergeComponent] Falha ao juntar PDFs:', error);
      alert('Ocorreu um erro ao juntar os ficheiros. Verifique se estão corrompidos ou protegidos por palavra-passe.');
    } finally {
      this.isProcessing.set(false);
    }
  }
}