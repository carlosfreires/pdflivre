# 📄 PDF Livre

> **Edite, junte e extraia páginas de PDFs de forma 100% segura e offline no seu navegador.**

[![Status](https://img.shields.io/badge/Status-MVP-blue.svg)]()

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Criador](https://img.shields.io/badge/Criador-Carlos_Freires-orange.svg)]()

[![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)]()

## 🚀 Sobre o Projeto

O **PDF Livre** é uma *Single Page Application* (SPA) open-source desenhada com um foco absoluto em **Performance, Experiência de Utilizador (UX) e Privacidade**.

No mercado atual, a maioria das ferramentas de edição de PDF exige que o utilizador faça o *upload* de documentos sensíveis para servidores de terceiros. O PDF Livre resolve este problema de segurança processando os seus ficheiros **100% localmente no navegador (Client-Side)**. O seu PDF nunca abandona a sua máquina.

Esta é a **Primeira Versão (MVP)** da plataforma, idealizada e arquitetada por **Carlos Freires**, aplicando os mais altos padrões da Engenharia de Software e *Frontend Architecture*.

## ✨ Funcionalidades Principais

* **✏️ Editor Visual (WYSIWYG):**
    * **Texto:** Adicione texto dinâmico com *auto-sizing* inteligente e formatação completa (fontes, tamanho, cor).
    * **Ocultar (Redact):** Esconda informações sensíveis utilizando tarjas configuráveis com suporte nativo a *EyeDropper* (Conta-Gotas) para mimetizar a cor do documento original.
    * **Assinaturas:** Motor de desenho de alto desempenho otimizado para *Touchscreen*, *Mouse* e *Stylus*, gerando assinaturas suaves com curvas de Bézier e suporte a tintas azul e preta.
    * **Imagens:** Inserção e redimensionamento visual de imagens genéricas no documento.
* **🔗 Juntar PDFs (Merge):** Combine múltiplos ficheiros PDF num único documento utilizando uma interface drag-and-drop intuitiva.
* **✂️ Extrair Páginas (Split):** Isole intervalos específicos de páginas para criar novos ficheiros segmentados.
* **⚙️ Gestão de Páginas:** Rotacione, mova e exclua páginas individuais em tempo real.

## 🛠️ Arquitetura e Stack Tecnológica

A aplicação foi construída para garantir estabilidade a 60FPS mesmo com ficheiros pesados, isolando a interface gráfica do processamento de dados.

* **Framework:** Angular (Standalone Components)
* **Linguagem:** TypeScript (Tipagem Estrita)
* **Reatividade:** Angular Signals (Para gestão de estado granular sem Zone.js *overhead*)
* **Processamento de Bytes:** `pdf-lib` (Manipulação estrutural do ArrayBuffer via Web Workers)
* **Renderização Visual:** `pdfjs-dist` e WebGL/Canvas API
* **UI/UX:** Padrões *Glassmorphism*, *CSS Grid* dinâmico e suporte integral Mobile-First.

## 💻 Como Executar Localmente

### Pré-requisitos

* [Node.js](https://nodejs.org/) (Versão 18 LTS ou superior recomendada)
* NPM ou Yarn

### Passo a Passo

1. Clone o repositório para a sua máquina local:

```bash
git clone [https://github.com/carlosfreires/pdflivre.git](https://github.com/carlosfreires/pdflivre.git)
```

1. Entre na diretoria do projeto:

```bash
cd pdf-livre
```

1. Instale todas as dependências:

```bash
npm install
```

1. Inicie o servidor de desenvolvimento:

```bash
npm start
```

1. Abra o seu navegador e acesse: **http://localhost:4200/**

## 🤝 Como Contribuir

Sendo um projeto open-source, contribuições de toda a comunidade são muito bem-vindas! Para contribuir:

1. Faça um Fork do projeto

1. Crie uma Branch para a sua Feature (git checkout -b feature/IdeiaIncrivel)

1. Faça Commit das suas alterações (git commit -m 'feat: Adiciona uma Ideia Incrível')

1. Faça Push para a Branch (git push origin feature/IdeiaIncrivel)

1. Abra um Pull Request detalhando o que foi alterado.

[^1]: Certifique-se de manter o padrão de código estabelecido no projeto e focar-se na performance do cliente (Client-Side processing).[^1]