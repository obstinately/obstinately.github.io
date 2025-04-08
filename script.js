// pdf.mjs import 및 워커 설정 (동일)
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

// 설정 변수 (동일)
const pdfPath = '경기도메뉴얼-2023.pdf';
const initialScale = 1.5;
const zoomStep = 0.2;
const minScale = 0.4;
const maxScale = 4.0;
const controlsTimeoutDuration = 2500;

// DOM 요소 가져오기 (캔버스 1개만 사용)
const viewerContainer = document.getElementById('viewer-container');
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('pdf-canvas'); // 단일 캔버스 참조
const ctx = canvas.getContext('2d');             // 단일 컨텍스트 참조
const controlsDiv = document.getElementById('controls');
const pageNumInput = document.getElementById('page-num-input');
// ... (나머지 버튼, span 등 동일)
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomInBtn = document.getElementById('zoom-in');
const zoomLevelSpan = document.getElementById('zoom-level');
const fullscreenBtn = document.getElementById('fullscreen');


// 상태 변수 (단순화)
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let currentScale = initialScale;
let isPageRendering = false; // 렌더링 중복 방지 플래그
// --- isAnimating, activeCanvas 등 슬라이드 관련 변수 제거 ---
let isTouchDevice = false;
let hideControlsTimer = null;

// 페이지 렌더링 함수 (단순화: 단일 캔버스 대상)
async function renderPage(num) { // targetCanvas, targetCtx 인수 제거
    if (isPageRendering) return; // 이미 렌더링 중이면 무시 (또는 대기 로직 추가 가능)
    if (!pdfDoc) return;

    isPageRendering = true;
    canvas.style.opacity = '0.5'; // 로딩 중 시각 효과
    updateControlsState(); // 렌더링 시작 시 버튼 비활성화

    try {
        const page = await pdfDoc.getPage(num);
        // 스케일 계산 방식 변경: 컨테이너 크기 기준
        const viewport = page.getViewport({ scale: 1 }); // 원본 크기 뷰포트
        const containerWidth = canvasContainer.clientWidth - 40; // 여백 고려
        const scale = Math.min(containerWidth / viewport.width, initialScale); // 컨테이너에 맞추거나 초기 스케일 사용
        const scaledViewport = page.getViewport({ scale: currentScale }); // 현재 스케일 적용

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderContext = {
            canvasContext: ctx, // 단일 컨텍스트 사용
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;

        // 페이지 번호 업데이트는 호출부에서 처리 (또는 여기서 해도 무방)
        pageNumInput.value = currentPageNum; // 렌더링 완료 후 입력 필드 업데이트

    } catch (error) {
        console.error(`페이지 ${num} 렌더링 오류:`, error);
    } finally {
        isPageRendering = false; // 렌더링 종료
        canvas.style.opacity = '1';
        updateControlsState(); // 렌더링 종료 후 버튼 상태 복원
    }
}

// 컨트롤 버튼 상태 업데이트 함수 (isAnimating 조건 제거)
function updateControlsState() {
    if (!pdfDoc) return;
    const disableButtons = isPageRendering; // 렌더링 중에만 비활성화

    prevPageBtn.disabled = (currentPageNum <= 1 || disableButtons);
    nextPageBtn.disabled = (currentPageNum >= totalPages || disableButtons);
    zoomOutBtn.disabled = (currentScale <= minScale || disableButtons);
    zoomInBtn.disabled = (currentScale >= maxScale || disableButtons);
    pageNumInput.disabled = disableButtons;
    pageNumInput.max = totalPages;
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
}

// --- onAnimationEnd 함수 제거 ---

// 다음 페이지 (단순화: renderPage 호출)
function showNextPage() {
    if (currentPageNum >= totalPages || isPageRendering) return;
    currentPageNum++;
    renderPage(currentPageNum);
}

// 이전 페이지 (단순화: renderPage 호출)
function showPrevPage() {
    if (currentPageNum <= 1 || isPageRendering) return;
    currentPageNum--;
    renderPage(currentPageNum);
}

// 특정 페이지로 이동 (단순화: renderPage 호출)
function goToPage(num) {
    if (isPageRendering) return;

    const pageNumber = Math.max(1, Math.min(parseInt(num, 10), totalPages));
    if (pageNumber !== currentPageNum) {
        currentPageNum = pageNumber;
        renderPage(currentPageNum);
    } else {
         // 같은 페이지 번호 입력 시 현재 페이지 값 유지
        pageNumInput.value = currentPageNum;
    }
}

// 배율 변경 (단순화: renderPage 호출)
function changeZoom(newScale) {
     if (isPageRendering) return;
    currentScale = Math.max(minScale, Math.min(newScale, maxScale));
    renderPage(currentPageNum); // 현재 페이지 다시 렌더링 (배율 변경됨)
}

// 확대/축소 함수 (동일)
function zoomIn() { changeZoom(currentScale + zoomStep); }
function zoomOut() { changeZoom(currentScale - zoomStep); }

// 전체 화면 토글 함수 (동일)
function toggleFullscreen() { /* ... 이전 코드 ... */ }

// 페이지 번호 입력 처리 함수 (동일)
function handlePageInput(e) { /* ... 이전 코드 ... */ }

// 터치 환경 컨트롤 관리 함수 (동일)
function showControlsAndStartTimer() { /* ... 이전 코드 ... */ }
function hideControlsImmediately() { /* ... 이전 코드 ... */ }


// 초기 PDF 로드 및 설정 함수
async function loadPdfAndSetup() {
    isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(hover: none)').matches);

    try {
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        pageCountSpan.textContent = totalPages;
        pageNumInput.max = totalPages;

        // 초기 첫 페이지 렌더링 (단일 캔버스 대상)
        await renderPage(currentPageNum); // renderPage 호출 단순화
        updateControlsState();

        // --- 이벤트 리스너 연결 --- (모바일 터치 로직 유지)
        prevPageBtn.addEventListener('click', showPrevPage);
        nextPageBtn.addEventListener('click', showNextPage);
        // ... (zoom, fullscreen, page input 리스너 동일)
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        pageNumInput.addEventListener('change', handlePageInput);
        pageNumInput.addEventListener('keyup', (e) => {
             if (e.key === 'Enter') { handlePageInput(e); e.target.blur(); }
        });


        // 키보드 네비게이션 (isAnimating 조건 제거)
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === pageNumInput) return;
            // if (isAnimating) return; // 제거

            if (e.key === 'ArrowLeft') { e.preventDefault(); showPrevPage(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); showNextPage(); }
            // ... (zoom, fullscreen 키 동일)
             else if (e.key === '+') { e.preventDefault(); zoomIn(); }
             else if (e.key === '-') { e.preventDefault(); zoomOut(); }
             else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen();}
        });

        // 터치 환경 이벤트 리스너 (동일하게 유지)
        if (isTouchDevice) {
            console.log("터치 장치 감지됨 - 터치 이벤트 리스너 활성화");
            viewerContainer.addEventListener('click', (e) => {
                 if (e.target === viewerContainer) { showControlsAndStartTimer(); }
            });
            canvasContainer.addEventListener('click', (e) => {
                 // 캔버스 클릭 시 로직 수정: 이제 단일 캔버스만 확인
                 if (e.target === canvas) { // canvas 변수 사용
                     if (viewerContainer.classList.contains('controls-visible')) {
                         hideControlsImmediately();
                         e.stopPropagation();
                     } else {
                         showControlsAndStartTimer();
                         e.stopPropagation();
                     }
                 }
            });
            controlsDiv.addEventListener('click', (e) => {
                showControlsAndStartTimer();
                e.stopPropagation();
            });
        }
         // --- 터치 환경 리스너 끝 ---

    } catch (error) {
        // 오류 처리 (동일)
        console.error('PDF 로드 오류:', error);
        controlsDiv.style.display = 'none';
        if(canvasContainer) canvasContainer.innerHTML = `<p style="color: red; padding: 20px;">오류: PDF 로드 실패...</p>`;
    }
}

// --- 실행 ---
loadPdfAndSetup();
