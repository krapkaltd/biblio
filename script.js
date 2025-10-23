// Глобальні змінні для IndexedDB
let db;
const DB_NAME = 'MathLibraryDB';
const STORE_NAME = 'materials';

// Змінні для управління файлами
let selectedFiles = [];
let currentObjectURL = null;

// Змінні для PDF.js
let pdfDoc = null;
let currentPageNum = 1;
let scale = 1.5;

// Змінні для контролю розміру шрифту в документах
let currentFontSize = 100;

// Змінні для GitHub Gist
const GIST_TOKEN_KEY = 'math_library_github_token';
const GIST_ID_KEY = 'math_library_gist_id';

// Збережемо оригінальний заголовок сторінки
const originalTitle = document.title;

// Ключ для зберігання стану перегляду в localStorage
const PREVIEW_STATE_KEY = 'math_library_preview_state';

document.addEventListener('DOMContentLoaded', function() {
    // Ініціалізація IndexedDB
    initIndexedDB().then(() => {
        console.log('IndexedDB ініціалізовано');
        displayMaterials();
        
        // Перевіряємо, чи є збережений стан перегляду
        checkAndRestorePreviewState();
    }).catch(error => {
        console.error('Помилка ініціалізації IndexedDB:', error);
    });
    
    // Навігація між вкладками
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Оновлення активних кнопок
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Оновлення активних вкладок
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });
    
    // Перемикання між типами завантаження
    const fileTypeBtn = document.getElementById('file-type-btn');
    const linkTypeBtn = document.getElementById('link-type-btn');
    const fileUploadGroup = document.getElementById('file-upload-group');
    const linkUploadGroup = document.getElementById('link-upload-group');
    
    fileTypeBtn.addEventListener('click', function() {
        setActiveUploadType('file');
    });
    
    linkTypeBtn.addEventListener('click', function() {
        setActiveUploadType('link');
    });
    
    function setActiveUploadType(type) {
        fileTypeBtn.classList.remove('active');
        linkTypeBtn.classList.remove('active');
        
        fileUploadGroup.style.display = 'none';
        linkUploadGroup.style.display = 'none';
        
        if (type === 'file') {
            fileTypeBtn.classList.add('active');
            fileUploadGroup.style.display = 'block';
        } else if (type === 'link') {
            linkTypeBtn.classList.add('active');
            linkUploadGroup.style.display = 'block';
        }
    }
    
    // Обробка вибору файлів
    const fileUpload = document.getElementById('file-upload');
    const fileInfo = document.getElementById('file-info');
    const filesList = document.getElementById('files-list');
    const filesContainer = document.getElementById('files-container');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');
    const batchUploadForm = document.getElementById('batch-upload-form');
    
    fileUpload.addEventListener('change', function(e) {
        const newFiles = Array.from(e.target.files);
        
        newFiles.forEach(file => {
            if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
            }
        });
        
        updateFilesList();
    });
    
    function updateFilesList() {
        if (selectedFiles.length > 0) {
            fileInfo.textContent = `Обрано ${selectedFiles.length} файлів`;
            filesList.style.display = 'block';
            
            filesContainer.innerHTML = '';
            
            selectedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                    <button class="remove-file" data-index="${index}">&times;</button>
                `;
                filesContainer.appendChild(fileItem);
            });
            
            document.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.getAttribute('data-index'));
                    selectedFiles.splice(index, 1);
                    updateFilesList();
                });
            });
        } else {
            fileInfo.textContent = 'Файли не обрані';
            filesList.style.display = 'none';
        }
    }
    
    clearBtn.addEventListener('click', function() {
        selectedFiles = [];
        updateFilesList();
        fileUpload.value = '';
    });
    
    batchUploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const category = document.getElementById('batch-category').value;
        
        if (!category) {
            alert('Будь ласка, оберіть категорію для файлів');
            return;
        }
        
        if (selectedFiles.length === 0) {
            alert('Будь ласка, оберіть файли для завантаження');
            return;
        }
        
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = 'Підготовка до завантаження...';
        
        let uploadedCount = 0;
        let errors = [];
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            try {
                await processFileUpload(file, category);
                uploadedCount++;
                
                const progress = (uploadedCount / selectedFiles.length) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Завантажено ${uploadedCount} з ${selectedFiles.length} файлів`;
            } catch (error) {
                console.error(`Помилка при завантаженні файлу ${file.name}:`, error);
                errors.push(file.name);
            }
        }
        
        setTimeout(() => {
            let message = `Успішно завантажено ${uploadedCount} з ${selectedFiles.length} файлів у категорію "${getCategoryName(category)}"`;
            
            if (errors.length > 0) {
                message += `\n\nПомилки при завантаженні: ${errors.join(', ')}`;
            }
            
            alert(message);
            
            selectedFiles = [];
            updateFilesList();
            fileUpload.value = '';
            progressBar.style.display = 'none';
            progressText.textContent = '';
            
            displayMaterials();
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`[data-tab="${category}"]`).classList.add('active');
            
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(category).classList.add('active');
        }, 500);
    });
    
    // Обробка форми для додавання посилань
    const linkMaterialForm = document.getElementById('link-material-form');
    linkMaterialForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const title = document.getElementById('link-title').value;
        const description = document.getElementById('link-description').value;
        const link = document.getElementById('link-url').value;
        const category = document.getElementById('link-category').value;
        
        if (!title || !link) {
            alert('Будь ласка, заповніть обов\'язкові поля');
            return;
        }
        
        const newMaterial = {
            title,
            category: category,
            description,
            type: 'link',
            link: link,
            createdAt: new Date().toISOString()
        };
        
        try {
            await saveMaterial(newMaterial);
            
            linkMaterialForm.reset();
            
            alert(`Посилання успішно додано до категорії "${getCategoryName(category)}"!`);
            
            displayMaterials();
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`[data-tab="${category}"]`).classList.add('active');
            
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(category).classList.add('active');
        } catch (error) {
            console.error('Помилка при додаванні посилання:', error);
            alert('Помилка при додаванні посилання');
        }
    });
    
    // Експорт даних
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // Імпорт даних
    document.getElementById('import-btn').addEventListener('click', function() {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', importData);
    
    // GitHub Gist функціонал
    document.getElementById('save-to-gist').addEventListener('click', saveToGist);
    document.getElementById('load-from-gist').addEventListener('click', loadFromGist);
    document.getElementById('clear-gist-token').addEventListener('click', clearGistToken);
    document.getElementById('github-token').addEventListener('change', saveToken);
    
    // Завантаження збереженого токена
    loadSavedToken();
    
    // Функція для форматування розміру файлу
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Байт';
        const k = 1024;
        const sizes = ['Байт', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function getCategoryName(category) {
        const categories = {
            'textbooks': 'Підручники',
            'algebra': 'Алгебра',
            'geometry': 'Геометрія',
            'useful': 'Корисне'
        };
        return categories[category] || category;
    }
    
    function processFileUpload(file, category) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async function(e) {
                const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                
                const newMaterial = {
                    title: fileNameWithoutExt,
                    category,
                    description: '',
                    type: 'file',
                    data: e.target.result,
                    fileName: file.name,
                    fileSize: formatFileSize(file.size),
                    fileType: file.type,
                    createdAt: new Date().toISOString()
                };
                
                try {
                    await saveMaterial(newMaterial);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = function() {
                reject(new Error('Помилка при читанні файлу'));
            };
            
            reader.readAsDataURL(file);
        });
    }
});

// ========== INDEXEDDB ФУНКЦІЇ ==========

function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('category', 'category', { unique: false });
            }
        };
        
        request.onblocked = () => {
            console.warn('База даних заблокована для оновлення');
        };
    });
}

function saveMaterial(material) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(material);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllMaterials() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteMaterial(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function clearAllMaterials() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getFileIcon(fileType) {
    if (fileType === 'application/pdf') return '📕';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('sheet')) return '📊';
    if (fileType.includes('presentation')) return '📑';
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('text/')) return '📄';
    return '📎';
}

async function displayMaterials() {
    try {
        const allMaterials = await getAllMaterials();
        
        document.getElementById('textbooks-materials').innerHTML = '';
        document.getElementById('algebra-materials').innerHTML = '';
        document.getElementById('geometry-materials').innerHTML = '';
        document.getElementById('useful-materials').innerHTML = '';
        
        const materialsByCategory = {
            textbooks: allMaterials.filter(m => m.category === 'textbooks'),
            algebra: allMaterials.filter(m => m.category === 'algebra'),
            geometry: allMaterials.filter(m => m.category === 'geometry'),
            useful: allMaterials.filter(m => m.category === 'useful')
        };
        
        Object.keys(materialsByCategory).forEach(category => {
            const container = document.getElementById(`${category}-materials`);
            const materials = materialsByCategory[category];
            
            if (materials.length === 0) {
                container.innerHTML = '<div class="empty-message">Поки що немає матеріалів у цьому розділі</div>';
            } else {
                materials.forEach(material => {
                    const materialItem = document.createElement('div');
                    materialItem.className = 'material-item';
                    
                    let fileIcon = '🔗';
                    let metaInfo = '';
                    let actions = '';
                    
                    if (material.type === 'file') {
                        fileIcon = getFileIcon(material.fileType);
                        metaInfo = `<div class="material-meta">${material.fileSize}</div>`;
                        actions = `
                            <a href="#" class="material-link preview-btn" data-id="${material.id}">Перегляд</a>
                            <a href="#" class="material-link download-btn" data-id="${material.id}" data-filename="${material.fileName}">Завантажити</a>
                        `;
                    } else {
                        actions = `<a href="${material.link}" target="_blank" class="material-link">Перейти</a>`;
                    }
                    
                    materialItem.innerHTML = `
                        <div class="material-icon">${fileIcon}</div>
                        <div class="material-content">
                            <div class="material-title">${material.type === 'file' ? material.fileName : material.title}</div>
                            ${material.description ? `<div class="material-description">${material.description}</div>` : ''}
                            ${metaInfo}
                        </div>
                        <div class="material-actions">
                            ${actions}
                            <a href="#" class="material-link delete-btn" data-id="${material.id}" style="color: var(--danger-color)">Видалити</a>
                        </div>
                    `;
                    
                    container.appendChild(materialItem);
                });
            }
        });
        
        addEventHandlers();
        
    } catch (error) {
        console.error('Помилка при відображенні матеріалів:', error);
    }
}

function addEventHandlers() {
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const materialId = parseInt(this.getAttribute('data-id'));
            openPreview(materialId);
        });
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const materialId = parseInt(this.getAttribute('data-id'));
            const fileName = this.getAttribute('data-filename');
            downloadMaterial(materialId, fileName);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const materialId = parseInt(this.getAttribute('data-id'));
            if (confirm('Ви впевнені, що хочете видалити цей матеріал?')) {
                deleteMaterial(materialId).then(() => {
                    displayMaterials();
                }).catch(error => {
                    console.error('Помилка видалення матеріалу:', error);
                    alert('Помилка видалення матеріалу');
                });
            }
        });
    });
}

// ========== ПЕРЕГЛЯД ФАЙЛІВ ==========

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
}

function convertDocxToHtml(blob) {
    return new Promise((resolve, reject) => {
        mammoth.convertToHtml({arrayBuffer: blob})
            .then(function(result){
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = result.value;
                const links = tempDiv.querySelectorAll('a[href]');
                links.forEach(link => {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                });
                resolve(tempDiv.innerHTML);
            })
            .catch(function(error) {
                reject(error);
            });
    });
}

function renderPage(pageNum, pdfDoc, container, currentScale) {
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: currentScale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page';
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        pageDiv.appendChild(canvas);
        container.innerHTML = '';
        container.appendChild(pageDiv);
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        page.render(renderContext);
    });
}

function onPrevPage() {
    if (currentPageNum <= 1) {
        return;
    }
    currentPageNum--;
    renderPage(currentPageNum, pdfDoc, document.getElementById('pdf-page-container'), scale);
    updatePdfPageInfo();
}

function onNextPage() {
    if (currentPageNum >= pdfDoc.numPages) {
        return;
    }
    currentPageNum++;
    renderPage(currentPageNum, pdfDoc, document.getElementById('pdf-page-container'), scale);
    updatePdfPageInfo();
}

function gotoPage(pageNum) {
    if (pageNum >= 1 && pageNum <= pdfDoc.numPages) {
        currentPageNum = pageNum;
        renderPage(currentPageNum, pdfDoc, document.getElementById('pdf-page-container'), scale);
        updatePdfPageInfo();
    }
}

function updatePdfPageInfo() {
    const pageInput = document.getElementById('pdf-page-input');
    const pageInfo = document.getElementById('pdf-page-info');
    if (pageInput) {
        pageInput.value = currentPageNum;
    }
    if (pageInfo) {
        pageInfo.textContent = ` / ${pdfDoc.numPages}`;
    }
}

function zoomIn() {
    if (scale < 3) {
        scale += 0.25;
        renderPage(currentPageNum, pdfDoc, document.getElementById('pdf-page-container'), scale);
    }
}

function zoomOut() {
    if (scale > 0.5) {
        scale -= 0.25;
        renderPage(currentPageNum, pdfDoc, document.getElementById('pdf-page-container'), scale);
    }
}

function increaseFontSize() {
    if (currentFontSize < 200) {
        currentFontSize += 10;
        updateFontSize();
    }
}

function decreaseFontSize() {
    if (currentFontSize > 50) {
        currentFontSize -= 10;
        updateFontSize();
    }
}

function updateFontSize() {
    const docPreview = document.querySelector('.doc-preview');
    const textPreview = document.querySelector('.text-preview');
    
    if (docPreview) {
        docPreview.style.fontSize = currentFontSize + '%';
    }
    if (textPreview) {
        textPreview.style.fontSize = currentFontSize + '%';
    }
    
    const fontSizeDisplay = document.getElementById('font-size-display');
    if (fontSizeDisplay) {
        fontSizeDisplay.textContent = currentFontSize + '%';
    }
}

function savePreviewState(materialId, fileName) {
    const previewState = {
        materialId: materialId,
        fileName: fileName,
        timestamp: Date.now()
    };
    localStorage.setItem(PREVIEW_STATE_KEY, JSON.stringify(previewState));
}

function clearPreviewState() {
    localStorage.removeItem(PREVIEW_STATE_KEY);
}

function checkAndRestorePreviewState() {
    const savedState = localStorage.getItem(PREVIEW_STATE_KEY);
    if (savedState) {
        try {
            const previewState = JSON.parse(savedState);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            
            if (now - previewState.timestamp < oneHour) {
                openPreview(previewState.materialId);
            } else {
                clearPreviewState();
            }
        } catch (error) {
            console.error('Помилка при відновленні стану перегляду:', error);
            clearPreviewState();
        }
    }
}

async function openPreview(materialId) {
    try {
        const material = await getMaterialById(materialId);
        if (!material || material.type !== 'file') return;
        
        const previewModal = document.getElementById('preview-modal');
        const previewTitle = document.getElementById('preview-title');
        const previewContainer = document.getElementById('preview-container');
        
        previewTitle.textContent = material.fileName;
        previewContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%;">Завантаження...</div>';
        
        previewModal.style.display = 'flex';
        
        currentFontSize = 100;
        
        document.title = material.fileName + ' - Математична бібліотека';
        
        savePreviewState(materialId, material.fileName);
        
        const fileType = material.fileType || 'application/octet-stream';
        const blob = dataURLToBlob(material.data);
        
        if (fileType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = material.data;
            img.alt = material.title;
            img.className = 'image-preview';
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
        } else if (fileType === 'application/pdf') {
            previewContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%;">Завантаження PDF...</div>';
            
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                
                loadingTask.promise.then(function(pdf) {
                    pdfDoc = pdf;
                    currentPageNum = 1;
                    scale = 1.5;
                    
                    const pdfContainer = document.createElement('div');
                    pdfContainer.className = 'pdf-container';
                    
                    const pdfControls = document.createElement('div');
                    pdfControls.className = 'pdf-controls';
                    
                    const prevButton = document.createElement('button');
                    prevButton.textContent = '← Попередня';
                    prevButton.addEventListener('click', onPrevPage);
                    
                    const pageInput = document.createElement('input');
                    pageInput.type = 'number';
                    pageInput.id = 'pdf-page-input';
                    pageInput.className = 'page-input';
                    pageInput.value = currentPageNum;
                    pageInput.min = 1;
                    pageInput.max = pdfDoc.numPages;
                    pageInput.addEventListener('change', function() {
                        gotoPage(parseInt(this.value));
                    });
                    
                    const pageInfo = document.createElement('span');
                    pageInfo.id = 'pdf-page-info';
                    pageInfo.textContent = ` / ${pdfDoc.numPages}`;
                    
                    const nextButton = document.createElement('button');
                    nextButton.textContent = 'Наступна →';
                    nextButton.addEventListener('click', onNextPage);
                    
                    const zoomControls = document.createElement('div');
                    zoomControls.className = 'zoom-controls';
                    
                    const zoomOutBtn = document.createElement('button');
                    zoomOutBtn.className = 'zoom-btn';
                    zoomOutBtn.textContent = '-';
                    zoomOutBtn.title = 'Зменшити';
                    zoomOutBtn.addEventListener('click', zoomOut);
                    
                    const zoomInBtn = document.createElement('button');
                    zoomInBtn.className = 'zoom-btn';
                    zoomInBtn.textContent = '+';
                    zoomInBtn.title = 'Збільшити';
                    zoomInBtn.addEventListener('click', zoomIn);
                    
                    zoomControls.appendChild(zoomOutBtn);
                    zoomControls.appendChild(zoomInBtn);
                    
                    pdfControls.appendChild(prevButton);
                    pdfControls.appendChild(pageInput);
                    pdfControls.appendChild(pageInfo);
                    pdfControls.appendChild(nextButton);
                    pdfControls.appendChild(zoomControls);
                    
                    const pdfViewer = document.createElement('div');
                    pdfViewer.className = 'pdf-viewer';
                    
                    const pageContainer = document.createElement('div');
                    pageContainer.id = 'pdf-page-container';
                    
                    pdfViewer.appendChild(pageContainer);
                    pdfContainer.appendChild(pdfControls);
                    pdfContainer.appendChild(pdfViewer);
                    
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(pdfContainer);
                    
                    renderPage(currentPageNum, pdfDoc, pageContainer, scale);
                    
                }).catch(function(error) {
                    console.error('Помилка завантаження PDF:', error);
                    previewContainer.innerHTML = `
                        <div class="unsupported-preview">
                            <p>Помилка при перегляді PDF файлу.</p>
                            <p>Будь ласка, завантажте файл для перегляду.</p>
                            <button class="material-link download-btn" data-id="${material.id}" data-filename="${material.fileName}">Завантажити файл</button>
                        </div>
                    `;
                });
            } catch (error) {
                console.error('Помилка обробки PDF:', error);
                previewContainer.innerHTML = `
                    <div class="unsupported-preview">
                        <p>Помилка при перегляді PDF файлу.</p>
                        <p>Будь ласка, завантажте файл для перегляду.</p>
                        <button class="material-link download-btn" data-id="${material.id}" data-filename="${material.fileName}">Завантажити файл</button>
                    </div>
                `;
            }
        } else if (fileType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document') || 
                   fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            previewContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%;">Конвертація DOCX...</div>';
            try {
                const htmlContent = await convertDocxToHtml(await blob.arrayBuffer());
                const docPreview = document.createElement('div');
                docPreview.className = 'doc-preview';
                docPreview.innerHTML = htmlContent;
                
                const docxContainer = document.createElement('div');
                docxContainer.className = 'pdf-container';
                
                const docxControls = document.createElement('div');
                docxControls.className = 'docx-controls';
                
                const fontSizeControls = document.createElement('div');
                fontSizeControls.className = 'font-size-controls';
                
                const fontSizeDecreaseBtn = document.createElement('button');
                fontSizeDecreaseBtn.className = 'font-size-btn';
                fontSizeDecreaseBtn.textContent = 'A-';
                fontSizeDecreaseBtn.title = 'Зменшити шрифт';
                fontSizeDecreaseBtn.addEventListener('click', decreaseFontSize);
                
                const fontSizeDisplay = document.createElement('span');
                fontSizeDisplay.id = 'font-size-display';
                fontSizeDisplay.className = 'font-size-display';
                fontSizeDisplay.textContent = currentFontSize + '%';
                
                const fontSizeIncreaseBtn = document.createElement('button');
                fontSizeIncreaseBtn.className = 'font-size-btn';
                fontSizeIncreaseBtn.textContent = 'A+';
                fontSizeIncreaseBtn.title = 'Збільшити шрифт';
                fontSizeIncreaseBtn.addEventListener('click', increaseFontSize);
                
                fontSizeControls.appendChild(fontSizeDecreaseBtn);
                fontSizeControls.appendChild(fontSizeDisplay);
                fontSizeControls.appendChild(fontSizeIncreaseBtn);
                
                docxControls.appendChild(fontSizeControls);
                docxContainer.appendChild(docxControls);
                docxContainer.appendChild(docPreview);
                
                previewContainer.innerHTML = '';
                previewContainer.appendChild(docxContainer);
                
                updateFontSize();
                
            } catch (error) {
                console.error('Помилка конвертації DOCX:', error);
                previewContainer.innerHTML = `
                    <div class="unsupported-preview">
                        <p>Помилка при перегляді DOCX файлу.</p>
                        <p>Будь ласка, завантажте файл для перегляду.</p>
                        <button class="material-link download-btn" data-id="${material.id}" data-filename="${material.fileName}">Завантажити файл</button>
                    </div>
                `;
            }
        } else if (fileType.startsWith('text/')) {
            const reader = new FileReader();
            reader.onload = function() {
                const pre = document.createElement('pre');
                pre.className = 'text-preview';
                pre.textContent = reader.result;
                
                const textContainer = document.createElement('div');
                textContainer.className = 'pdf-container';
                
                const textControls = document.createElement('div');
                textControls.className = 'docx-controls';
                
                const fontSizeControls = document.createElement('div');
                fontSizeControls.className = 'font-size-controls';
                
                const fontSizeDecreaseBtn = document.createElement('button');
                fontSizeDecreaseBtn.className = 'font-size-btn';
                fontSizeDecreaseBtn.textContent = 'A-';
                fontSizeDecreaseBtn.title = 'Зменшити шрифт';
                fontSizeDecreaseBtn.addEventListener('click', decreaseFontSize);
                
                const fontSizeDisplay = document.createElement('span');
                fontSizeDisplay.id = 'font-size-display';
                fontSizeDisplay.className = 'font-size-display';
                fontSizeDisplay.textContent = currentFontSize + '%';
                
                const fontSizeIncreaseBtn = document.createElement('button');
                fontSizeIncreaseBtn.className = 'font-size-btn';
                fontSizeIncreaseBtn.textContent = 'A+';
                fontSizeIncreaseBtn.title = 'Збільшити шрифт';
                fontSizeIncreaseBtn.addEventListener('click', increaseFontSize);
                
                fontSizeControls.appendChild(fontSizeDecreaseBtn);
                fontSizeControls.appendChild(fontSizeDisplay);
                fontSizeControls.appendChild(fontSizeIncreaseBtn);
                
                textControls.appendChild(fontSizeControls);
                textContainer.appendChild(textControls);
                textContainer.appendChild(pre);
                
                previewContainer.innerHTML = '';
                previewContainer.appendChild(textContainer);
                
                updateFontSize();
            };
            reader.readAsText(blob);
        } else {
            previewContainer.innerHTML = `
                <div class="unsupported-preview">
                    <p>Перегляд цього типу файлів не підтримується.</p>
                    <p>Будь ласка, завантажте файл для перегляду.</p>
                    <button class="material-link download-btn" data-id="${material.id}" data-filename="${material.fileName}">Завантажити файл</button>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Помилка при відкритті перегляду:', error);
        alert('Помилка відкриття файлу для перегляду');
    }
}

function getMaterialById(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function downloadMaterial(materialId, fileName) {
    try {
        const material = await getMaterialById(materialId);
        if (!material || material.type !== 'file') return;
        
        const a = document.createElement('a');
        a.href = material.data;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('Помилка при завантаженні файлу:', error);
        alert('Помилка завантаження файлу');
    }
}

function closePreviewModal() {
    if (currentObjectURL) {
        URL.revokeObjectURL(currentObjectURL);
        currentObjectURL = null;
    }
    document.getElementById('preview-modal').style.display = 'none';
    
    document.title = originalTitle;
    
    clearPreviewState();
}

document.getElementById('close-preview').addEventListener('click', closePreviewModal);

document.getElementById('preview-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closePreviewModal();
    }
});

// ========== ЕКСПОРТ/ІМПОРТ ==========

async function exportData() {
    try {
        const materials = await getAllMaterials();
        const dataStr = JSON.stringify(materials, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'math_library_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        alert(`Експорт завершено! Експортовано ${materials.length} матеріалів.`);
    } catch (error) {
        console.error('Помилка експорту:', error);
        alert('Помилка експорту даних');
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const materials = JSON.parse(e.target.result);
                
                if (!Array.isArray(materials)) {
                    throw new Error('Некоректний формат файлу');
                }
                
                if (!confirm(`Ви впевнені, що хочете імпортувати ${materials.length} матеріалів? Існуючі матеріали будуть перезаписані.`)) {
                    return;
                }
                
                await clearAllMaterials();
                
                for (const material of materials) {
                    await saveMaterial(material);
                }
                
                await displayMaterials();
                
                alert(`Імпорт завершено! Успішно імпортовано ${materials.length} матеріалів.`);
                
            } catch (error) {
                console.error('Помилка імпорту:', error);
                alert('Помилка імпорту даних: ' + error.message);
            }
        };
        
        reader.readAsText(file);
        
    } catch (error) {
        console.error('Помилка читання файлу:', error);
        alert('Помилка читання файлу');
    }
    
    event.target.value = '';
}

// ========== GITHUB GIST ФУНКЦІОНАЛ ==========

function loadSavedToken() {
    const savedToken = localStorage.getItem(GIST_TOKEN_KEY);
    const savedGistId = localStorage.getItem(GIST_ID_KEY);
    
    if (savedToken) {
        document.getElementById('github-token').value = savedToken;
    }
    
    if (savedGistId) {
        showGistStatus(`Знайдено збережений Gist: ${savedGistId}`, 'success');
    }
}

function saveToken() {
    const token = document.getElementById('github-token').value.trim();
    if (token) {
        localStorage.setItem(GIST_TOKEN_KEY, token);
        showGistStatus('Токен збережено в цьому браузері', 'success');
    }
}

function clearGistToken() {
    localStorage.removeItem(GIST_TOKEN_KEY);
    localStorage.removeItem(GIST_ID_KEY);
    document.getElementById('github-token').value = '';
    document.getElementById('gist-status').innerHTML = '';
    showGistStatus('Токен очищено', 'success');
}

function showGistStatus(message, type = 'success') {
    const statusDiv = document.getElementById('gist-status');
    statusDiv.className = `gist-status ${type}`;
    statusDiv.innerHTML = message;
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.innerHTML = '';
            statusDiv.className = '';
        }, 5000);
    }
}

async function saveToGist() {
    const token = document.getElementById('github-token').value.trim();
    if (!token) {
        showGistStatus('Будь ласка, введіть GitHub токен', 'error');
        return;
    }
    
    try {
        const materials = await getAllMaterials();
        const dataStr = JSON.stringify(materials, null, 2);
        const fileName = 'math_library_backup.json';
        const description = 'Математична бібліотека - резервна копія';
        
        const existingGistId = localStorage.getItem(GIST_ID_KEY);
        
        let gistUrl, gistId;
        
        if (existingGistId) {
            const response = await updateGist(existingGistId, token, dataStr, description);
            gistUrl = response.html_url;
            gistId = response.id;
            showGistStatus(`Дані оновлено в Gist! <a href="${gistUrl}" target="_blank" class="gist-link">Переглянути на GitHub</a>`, 'success');
        } else {
            const response = await createGist(token, dataStr, fileName, description);
            gistUrl = response.html_url;
            gistId = response.id;
            localStorage.setItem(GIST_ID_KEY, gistId);
            showGistStatus(`Дані збережено в новий Gist! <a href="${gistUrl}" target="_blank" class="gist-link">Переглянути на GitHub</a>`, 'success');
        }
        
        const gistInfo = document.createElement('div');
        gistInfo.className = 'gist-info';
        gistInfo.innerHTML = `Gist ID: ${gistId}`;
        document.getElementById('gist-status').appendChild(gistInfo);
        
    } catch (error) {
        console.error('Помилка збереження в Gist:', error);
        showGistStatus(`Помилка збереження: ${error.message}`, 'error');
    }
}

async function loadFromGist() {
    const token = document.getElementById('github-token').value.trim();
    if (!token) {
        showGistStatus('Будь ласка, введіть GitHub токен', 'error');
        return;
    }
    
    try {
        let gistId = localStorage.getItem(GIST_ID_KEY);
        
        if (!gistId) {
            gistId = prompt('Будь ласка, введіть Gist ID:');
            if (!gistId) return;
        }
        
        const gistData = await getGist(gistId, token);
        const materials = JSON.parse(gistData);
        
        if (!Array.isArray(materials)) {
            throw new Error('Некоректний формат даних у Gist');
        }
        
        if (!confirm(`Ви впевнені, що хочете імпортувати ${materials.length} матеріалів з хмари? Існуючі матеріали будуть перезаписані.`)) {
            return;
        }
        
        await clearAllMaterials();
        
        for (const material of materials) {
            await saveMaterial(material);
        }
        
        await displayMaterials();
        
        showGistStatus(`Успішно імпортовано ${materials.length} матеріалів з хмари!`, 'success');
        
    } catch (error) {
        console.error('Помилка завантаження з Gist:', error);
        showGistStatus(`Помилка завантаження: ${error.message}`, 'error');
    }
}

async function createGist(token, content, fileName, description) {
    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            description: description,
            public: false,
            files: {
                [fileName]: {
                    content: content
                }
            }
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Помилка HTTP: ${response.status}`);
    }
    
    return await response.json();
}

async function updateGist(gistId, token, content, description) {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
            description: description,
            files: {
                'math_library_backup.json': {
                    content: content
                }
            }
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Помилка HTTP: ${response.status}`);
    }
    
    return await response.json();
}

async function getGist(gistId, token) {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Помилка HTTP: ${response.status}`);
    }
    
    const gist = await response.json();
    const file = gist.files['math_library_backup.json'];
    
    if (!file) {
        throw new Error('Файл math_library_backup.json не знайдено в Gist');
    }
    
    return file.content;
}