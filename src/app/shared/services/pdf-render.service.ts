import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

// Configuração do Worker do PDF.js (Obrigatório para performance client-side off-main-thread)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs'; 

export interface RenderDimensions {
  width: number;
  height: number;
}

/**
 * Interface que define um item na fila de renderização de alta performance.
 */
export interface QueueItem {
  execute: () => Promise<void>;
  reject: (reason?: Error | unknown) => void;
  isPriority: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PdfRenderService {
  
  // ==========================================================================
  // ESTADO PRIVADO DO MOTOR
  // ==========================================================================
  private currentPdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  
  /** Mantém o rastro da tarefa principal para cancelamentos instantâneos (Debounce visual) */
  private mainRenderTask: pdfjsLib.RenderTask | null = null; 
  
  /** Registo de TODAS as tarefas ativas para garantir destruição massiva no fechamento do arquivo */
  private activeRenderTasks = new Set<pdfjsLib.RenderTask>();

  // ==========================================================================
  // SISTEMA DE FILA E CONCORRÊNCIA (Proteção da Main Thread e GPU)
  // ==========================================================================
  private renderQueue: QueueItem[] = [];
  private activeRenders = 0;
  
  /** Limite rigoroso de uso de CPU/WebGL simultâneo. 2 é o "Sweet Spot" para browsers mobiles/desktops. */
  private readonly MAX_CONCURRENCY = 2; 

  /** * Limite seguro para escala de pixel. 
   * Previne Canvas "Out of Memory" crashes em ecrãs Super Retina (3x/4x) quando combinados com Zoom.
   */
  private readonly MAX_PIXEL_RATIO = 2;

  /**
   * Lê o buffer bruto em memória e extrai a estrutura de visualização do PDF.
   * @param buffer O ArrayBuffer do arquivo
   * @returns O número total de páginas processadas
   */
  async loadDocument(buffer: ArrayBuffer): Promise<number> {
    try {
      this.unloadDocument(); 

      // Fazemos uma fatia do buffer para garantir que o Worker local não o "roube" (detach)
      const data = new Uint8Array(buffer.slice(0));
      const loadingTask = pdfjsLib.getDocument({ data });
      
      this.currentPdfDocument = await loadingTask.promise;
      
      return this.currentPdfDocument.numPages;
    } catch (error) {
      console.error('Erro ao processar o PDF no motor visual:', error);
      throw new Error('Falha ao ler o ficheiro PDF.');
    }
  }

  /**
   * Elimina completamente a presença do documento atual da RAM e limpa a fila.
   * Fundamental para arquiteturas SPA de alta performance (Zero Memory Leaks).
   */
  unloadDocument(): void {
    // 1. Rejeita graciosamente todas as promises que ficaram pendentes na fila
    for (const item of this.renderQueue) {
      item.reject(new Error('Documento descarregado antes da renderização.'));
    }
    this.renderQueue = [];

    // 2. Cancela a tarefa principal de imediato
    if (this.mainRenderTask) {
      this.mainRenderTask.cancel();
      this.mainRenderTask = null;
    }

    // 3. Cancela TODAS as outras tarefas (ex: Sidebar thumbnails) que estejam ativas
    for (const task of this.activeRenderTasks) {
      task.cancel();
    }
    this.activeRenderTasks.clear();
    
    // 4. Destruição profunda do Documento na engine do PDF.js 
    // CORREÇÃO: Utilizando a API estrita .cleanup() do PDFDocumentProxy
    if (this.currentPdfDocument) {
      this.currentPdfDocument.cleanup();
      this.currentPdfDocument = null;
    }
  }

  /**
   * Empacota o pedido de renderização numa fila segura gerida de forma concorrente.
   * @param pageNumber O índice da página a renderizar (Começa em 1)
   * @param canvas A referência do DOM nativo do <canvas>
   * @param zoom Multiplicador de escala da visualização
   * @param isPriority Se for true, atira a tarefa para o Topo da fila (usado no Viewer central)
   */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, zoom: number = 1.0, isPriority: boolean = false): Promise<RenderDimensions> {
    return new Promise((resolve, reject) => {
      
      const execute = async () => {
        if (!this.currentPdfDocument) {
          reject(new Error('Nenhum documento PDF carregado.'));
          return;
        }

        let renderTask: pdfjsLib.RenderTask | null = null;

        try {
          const page = await this.currentPdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale: zoom });

          // Calcula a escala real do monitor vs o limite seguro estabelecido
          const deviceRatio = window.devicePixelRatio || 1;
          const outputScale = Math.min(deviceRatio, this.MAX_PIXEL_RATIO);
          
          const cssWidth = viewport.width;
          const cssHeight = viewport.height;
          
          const canvasWidth = Math.floor(cssWidth * outputScale);
          const canvasHeight = Math.floor(cssHeight * outputScale);

          // Previne Exceções no DOM caso o componente seja colapsado (Zero-size canvas)
          if (canvasWidth === 0 || canvasHeight === 0) {
            resolve({ width: 0, height: 0 });
            return;
          }

          // Ajuste de atributos internos vs CSS para nitidez ("Retina Ready")
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          canvas.style.width = `${Math.floor(cssWidth)}px`;
          canvas.style.height = `${Math.floor(cssHeight)}px`;

          // OTIMIZAÇÃO GPU: { alpha: false } desativa o blending na VRAM, acelerando a pintura
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Falha ao obter o contexto 2D do Canvas.');

          // Como o alpha está desativado, preenchemos o fundo com branco absoluto nativamente
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvasWidth, canvasHeight);

          // Reset explícito da matriz de transformação para impedir artefactos visuais ao reciclar canvas
          context.resetTransform();
          context.transform(outputScale, 0, 0, outputScale, 0, 0);

          // CORREÇÃO: Adicionada a referência 'canvas' de volta, obrigatória pela API do pdfjs-dist
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          };

          renderTask = page.render(renderContext);

          // Se é a view principal, atualiza a referência única para permitir debouncing
          if (isPriority) {
            if (this.mainRenderTask) this.mainRenderTask.cancel();
            this.mainRenderTask = renderTask;
          }

          // Adiciona ao set de rastreio de tarefas ativas
          this.activeRenderTasks.add(renderTask);

          await renderTask.promise;
          resolve({ width: cssWidth, height: cssHeight });

        } catch (error: unknown) {
          const isCancelled = (error as Error)?.name === 'RenderingCancelledException';
          
          if (isCancelled) {
            // Cancelamentos de scroll ou recarregamentos são esperados, saímos com elegância
            resolve({ width: 0, height: 0 }); 
          } else {
            console.error(`Erro ao renderizar a página ${pageNumber}:`, error);
            reject(error);
          }
        } finally {
          // Assegura que limpamos a tarefa do Set de lixo independentemente de ter dado sucesso/erro
          if (renderTask) {
            this.activeRenderTasks.delete(renderTask);
          }
        }
      };

      const queueItem: QueueItem = { execute, reject, isPriority };

      // Se for prioridade, insere no início da matriz O(n). Senão empurra para o fim O(1).
      if (isPriority) {
        this.renderQueue.unshift(queueItem);
      } else {
        this.renderQueue.push(queueItem);
      }

      this.processQueue();
    });
  }

  /**
   * Loop recursivo e assíncrono que processa a fila respeitando os limites da máquina.
   */
  private async processQueue(): Promise<void> {
    // Se a máquina estiver no limite (Concorrência máxima atingida) ou a fila estiver vazia, ignora
    if (this.activeRenders >= this.MAX_CONCURRENCY || this.renderQueue.length === 0) return;

    this.activeRenders++;
    const item = this.renderQueue.shift();

    if (item) {
      try {
        await item.execute();
      } catch (e) {
        // Erros bloqueantes (não-cancelamentos) já foram repassados para a UI pelo reject() na Promise
      }
    }

    this.activeRenders--;
    
    // OTIMIZAÇÃO DE EVENT LOOP: O setTimeout 0 cede o ciclo de pintura ao navegador, 
    // garantindo 60FPS nas animações da interface mesmo sob carga intensa de renderização.
    setTimeout(() => this.processQueue(), 0);
  }
}