// pdf.mjs에서 필요한 객체 가져오기
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// PDF.js 워커 경로 설정 (GitHub Pages 환경에 맞게)
// pdf.worker.mjs 파일을 다운로드하여 같은 폴더에 두거나, 아래 CDN 경로 유지
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

const pdfPath = '경기도메뉴얼-2023.pdf'; // PDF 파일 경로 (index.html 기준)
const viewerContainer = document.getElementById('viewer-container');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomInBtn = document.getElementById('zoom-in');
const zoomLevelSpan = document.getElementById('zoom-level');
const fullscreenBtn = document.getElementById('fullscreen');

let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let currentScale = 1.0; // 초기 배율
const zoomStep = 0.2; // 확대/축소 단계

// 페이지 렌더링 함수
async function renderPage(num) {
    if (!pdfDoc) return;

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: currentScale });

        // Canvas 크기 설정
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // 페이지 렌더링
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // 현재 페이지 번호 업데이트 및 입력 필드 설정
        currentPageNum = num;
        pageNumInput.value = currentPageNum;

        // 버튼 활성화/비활성화
        prevPageBtn.disabled = (currentPageNum <= 1);
        nextPageBtn.disabled = (currentPageNum >= totalPages);
        pageNumInput.max = totalPages;

    } catch (error) {
        console.error('페이지 렌더링 오류:', error);
        alert(`페이지 ${num}을(를) 렌더링하는 중 오류가 발생했습니다.`);
    }
}

// 페이지 이동 함수
function goToPage(num) {
    if (num >= 1 && num <= totalPages) {
        renderPage(num);
    }
}

// 이전 페이지
function showPrevPage() {
    if (currentPageNum > 1) {
        goToPage(currentPageNum - 1);
    }
}

// 다음 페이지
function showNextPage() {
    if (currentPageNum < totalPages) {
        goToPage(currentPageNum + 1);
    }
}

// 확대
function zoomIn() {
    currentScale += zoomStep;
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
    renderPage(currentPageNum); // 현재 페이지 다시 렌더링
}

// 축소
function zoomOut() {
    if (currentScale <= zoomStep) return; // 최소 배율 제한
    currentScale -= zoomStep;
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
    renderPage(currentPageNum); // 현재 페이지 다시 렌더링
}

// 전체 화면 토글
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        viewerContainer.requestFullscreen().catch(err => {
            alert(`전체 화면 모드를 시작할 수 없습니다: <span class="math-inline">\{err\.message\} \(</span>{err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// 페이지 번호 입력 처리
function handlePageInput(e) {
    const requestedPage = parseInt(e.target.value, 10);
    if (!isNaN(requestedPage)) {
        goToPage(requestedPage);
    }
}

// 초기 PDF 로드
async function loadPdf() {
    try {
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        // 총 페이지 수 업데이트
        pageCountSpan.textContent = totalPages;
        pageNumInput.max = totalPages;

        // 첫 페이지 렌더링
        renderPage(currentPageNum);

        // 이벤트 리스너 연결
        prevPageBtn.addEventListener('click', showPrevPage);
        nextPageBtn.addEventListener('click', showNextPage);
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        pageNumInput.addEventListener('change', handlePageInput);
        pageNumInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handlePageInput(e);
            }
        });

        // 키보드 네비게이션 (좌/우 화살표)
        document.addEventListener('keydown', (e) => {
             if (e.target === pageNumInput) return; // 입력 필드 포커스 시 제외
             if (e.key === 'ArrowLeft') {
                 showPrevPage();
             } else if (e.key === 'ArrowRight') {
                 showNextPage();
             }
         });


    } catch (error) {
        console.error('PDF 로드 오류:', error);
        alert(`PDF 파일(${pdfPath})을 로드하는 중 오류가 발생했습니다. 파일 경로와 상태를 확인하세요.`);
        // 오류 메시지를 사용자에게 더 친절하게 표시할 수 있습니다.
        document.getElementById('controls').innerHTML = '<span style="color: red;">PDF 로드 실패. 파일 경로를 확인하세요.</span>';
        document.getElementById('canvas-container').style.display = 'none';
    }
}

// PDF 로드 시작
loadPdf();
