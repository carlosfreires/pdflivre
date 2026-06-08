import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfMutateService } from '../../shared/services/pdf-mutate.service';
import { PDFDocument } from 'pdf-lib';

@Component({
  selector: 'app-split',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="operation-container">
      <h2>Extrair Páginas (Split)</h2>
      <p class="subtitle">Selecione um PDF e defina o intervalo exato de páginas que deseja isolar num novo ficheiro.</p>

      @if (!fileBuffer()) {
        <div 
          class="upload-area dropzone" 
          [class.drag-active]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)">
          
          <div class="drop-content">
            <p class="drop-hint">Arraste o seu PDF aqui</p>
            <span class="drop-or">ou</span>
            <label class="btn-upload" [class.disabled]="isProcessing()">
              Selecionar Ficheiro
              <input 
                type="file" 
                accept="application/pdf" 
                (change)="onFileSelected($event)" 
                [disabled]="isProcessing()" 
                hidden>
            </label>
          </div>
          
          @if (isProcessing()) {
            <div class="loading-overlay">
              <span>A carregar documento...</span>
            </div>
          }
        </div>
      } @else {
        <div class="config-area">
          <div class="file-info">
            <span class="file-name" [title]="fileName()">Ficheiro: <strong>{{ fileName() }}</strong></span>
            <span class="file-pages">Total de páginas: <strong>{{ totalPages() }}</strong></span>
          </div>

          <div class="range-inputs">
            <div class="input-group">
              <label for="startPageInput">Página Inicial</label>
              <input 
                id="startPageInput"
                type="number" 
                [ngModel]="startPage()" 
                (ngModelChange)="startPage.set($event)" 
                min="1" 
                [max]="totalPages()"
                [class.invalid]="!isValidRange()">
            </div>
            
            <span class="separator" aria-hidden="true">até</span>
            
            <div class="input-group">
              <label for="endPageInput">Página Final</label>
              <input 
                id="endPageInput"
                type="number" 
                [ngModel]="endPage()" 
                (ngModelChange)="endPage.set($event)" 
                [min]="startPage()" 
                [max]="totalPages()"
                [class.invalid]="!isValidRange()">
            </div>
          </div>
          
          @if (!isValidRange()) {
            <p class="error-msg">O intervalo introduzido não é válido.</p>
          }

          <div class="actions">
            <button class="btn-outline" (click)="reset()" [disabled]="isProcessing()">Cancelar</button>
            <button class="btn-primary" (click)="processSplit()" [disabled]="isProcessing() || !isValidRange()">
              {{ isProcessing() ? 'A processar extração...' : 'Extrair e Transferir' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .operation-container {
      max-width: 650px; margin: 40px auto; padding: 32px;
      background: #ffffff; border-radius: 16px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    h2 { margin: 0 0 8px 0; color: #0f172a; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .subtitle { color: #64748b; margin-top: 0; margin-bottom: 28px; font-size: 0.95rem; }

    /* Dropzone Baseada nas Melhores Práticas */
    .dropzone { 
      position: relative; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;
      padding: 40px 24px; transition: all 0.2s ease-in-out; overflow: hidden;
    }
    .dropzone.drag-active { border-color: #3b82f6; background: #eff6ff; }
    .drop-content { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
    .drop-hint { font-weight: 500; color: #475569; margin: 0; }
    .drop-or { font-size: 0.85rem; color: #94a3b8; }
    
    .loading-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(255, 255, 255, 0.85); display: flex; align-items: center; justify-content: center;
      font-weight: 600; color: #2563eb; backdrop-filter: blur(2px); z-index: 10;
    }

    .btn-upload {
      display: inline-block; padding: 10px 20px; background: #ffffff; border: 1px solid #cbd5e1;
      border-radius: 6px; color: #0f172a; font-weight: 500; cursor: pointer;
      transition: all 0.2s; font-size: 0.95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .btn-upload:hover:not(.disabled) { border-color: #94a3b8; background: #f1f5f9; }
    .btn-upload.disabled { opacity: 0.5; cursor: not-allowed; }

    .config-area { display: flex; flex-direction: column; gap: 24px; animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

    .file-info {
      display: flex; flex-direction: column; gap: 6px; padding: 16px;
      background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
      color: #334155; font-size: 0.95rem;
    }
    .file-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Inputs Premium Ergonomicamente Otimizados */
    .range-inputs { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 8px; }
    .input-group { display: flex; flex-direction: column; gap: 6px; }
    .input-group label { font-size: 0.85rem; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    
    .input-group input {
      padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff;
      width: 120px; font-size: 1.1rem; text-align: center; color: #0f172a; font-weight: 500;
      transition: all 0.2s; outline: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .input-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
    .input-group input.invalid { border-color: #ef4444; color: #dc2626; background: #fef2f2; }
    .input-group input.invalid:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
    
    .separator { color: #94a3b8; font-weight: 500; margin-top: 24px; }
    .error-msg { text-align: center; color: #ef4444; font-size: 0.85rem; font-weight: 500; margin: -10px 0 0 0; }

    .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
    button { padding: 14px 24px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; outline: none; }
    button:focus-visible { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4); }
    
    .btn-outline { background: transparent; border: 1px solid #cbd5e1; color: #475569; }
    .btn-outline:hover:not(:disabled) { background: #f1f5f9; color: #0f172a; }
    
    .btn-primary { background: #2563eb; color: white; border: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.3); transform: translateY(-1px); }
    .btn-primary:active:not(:disabled) { transform: translateY(0); }
    
    button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }

    /* Media Queries para Mobile */
    @media (max-width: 600px) {
      .operation-container { margin: 16px; padding: 20px; }
      .range-inputs { flex-direction: column; gap: 12px; }
      .separator { display: none; }
      .input-group input { width: 100%; }
      .actions { flex-direction: column-reverse; }
    }
  `]
})
export class SplitComponent {
  private readonly pdfMutate = inject(PdfMutateService);

  // Estados locais do componente
  fileBuffer = signal<ArrayBuffer | null>(null);
  fileName = signal<string>('');
  totalPages = signal<number>(0);
  isProcessing = signal(false);
  isDragging = signal(false);

  // Modelos de input
  startPage = signal<number>(1);
  endPage = signal<number>(1);

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

    const file = event.dataTransfer?.files[0];
    if (file && file.type === 'application/pdf') {
      this.processNewFile(file);
    } else {
      alert('Por favor, adicione apenas ficheiros no formato PDF.');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file && file.type === 'application/pdf') {
      this.processNewFile(file);
    }
    input.value = ''; 
  }

  private async processNewFile(file: File): Promise<void> {
    // Bloqueia a UI para evitar duplo clique ou lentidão percecionada em PDFs gigantes
    this.isProcessing.set(true);
    
    try {
      this.fileName.set(file.name);
      
      const buffer = await file.arrayBuffer();
      this.fileBuffer.set(buffer);

      // Leitura da estrutura nativa do PDF na Main Thread
      const pdfDoc = await PDFDocument.load(buffer);
      const count = pdfDoc.getPageCount();
      
      this.totalPages.set(count);
      this.startPage.set(1);
      this.endPage.set(count);
      
    } catch (e) {
      console.error('[SplitComponent] Erro no parsing do documento:', e);
      alert('Ocorreu um erro ao tentar ler o ficheiro PDF. Pode estar protegido ou corrompido.');
      this.reset();
    } finally {
      this.isProcessing.set(false);
    }
  }

  // ==========================================================================
  // LÓGICA DE VALIDAÇÃO E MUTAÇÃO
  // ==========================================================================

  /**
   * Avalia se a seleção numérica inserida pelo utilizador garante a extração de páginas válidas.
   */
  isValidRange(): boolean {
    const start = this.startPage();
    const end = this.endPage();
    const total = this.totalPages();
    return start !== null && end !== null && start >= 1 && end <= total && start <= end;
  }

  async processSplit(): Promise<void> {
    const buffer = this.fileBuffer();
    if (!buffer || !this.isValidRange()) return;

    this.isProcessing.set(true);
    try {
      // Delega a mutação pesada ao Web Worker, garantindo 60FPS na UI
      const newBuffer = await this.pdfMutate.extractPages(buffer, this.startPage(), this.endPage());
      
      const newName = this.fileName().replace('.pdf', `_paginas_${this.startPage()}-${this.endPage()}.pdf`);
      this.pdfMutate.saveDocumentLocally(newBuffer, newName);
      
      this.reset();
    } catch (error) {
      console.error('[SplitComponent] Falha ao extrair páginas:', error);
      alert('Ocorreu um erro ao tentar extrair as páginas do PDF.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  reset(): void {
    this.fileBuffer.set(null);
    this.fileName.set('');
    this.totalPages.set(0);
    this.startPage.set(1);
    this.endPage.set(1);
  }
}