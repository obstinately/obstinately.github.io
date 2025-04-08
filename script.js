// pdf.mjs import 및 워커 설정
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';
// 워커 경로 설정 (CDN 또는 로컬 경로 - 로컬화했다면 './pdf.worker.mjs' 사용)
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';
// pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs'; // 로컬 워커 사용 시

// 설정 변수
const pdfPath = '경기도메뉴얼-2023.pdf'; // PDF 파일 경로 확인!
const initialScale = 1.5;
const zoomStep = 0.2;
const minScale = 0.4;
const maxScale = 4.0;
const controlsTimeoutDuration = 2500; // 자동 숨김 시간 (ms)

// DOM 요소 가져오기
const viewerContainer = document.getElementById('viewer-container');
const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('pdf-canvas'); // 단일 캔버스
const ctx = canvas.getContext('2d');
const controlsDiv = document.getElementById('controls');
const pageNumInput = document.getElementById('page-num-input');
const pageCountSpan = document.getElementById('page-count');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomInBtn = document.getElementById('zoom-in');
const zoomLevelSpan = document.getElementById('zoom-level');
const fullscreenBtn = document.getElementById('fullscreen');

// 상태 변수
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let currentScale = initialScale;
let isPageRendering = false;
let isTouchDevice = false;
let hideControlsTimer = null;

// 페이지 렌더링 함수
async function renderPage(num) {
    if (isPageRendering) return;
    if (!pdfDoc) return;

    isPageRendering = true;
    canvas.style.opacity = '0.5';
    updateControlsState();

    try {
        const page = await pdfDoc.getPage(num);

        // 스케일 계산 및 뷰포트 설정 (컨테이너 크기 고려)
        const viewportBase = page.getViewport({ scale: 1 }); // 기본 크기
        let desiredWidth = viewportBase.width * currentScale;
        let desiredHeight = viewportBase.height * currentScale;
        const maxWidth = canvasContainer.clientWidth - 40; // 좌우 여백 고려
        const maxHeight = canvasContainer.clientHeight - 40; // 상하 여백 고려

        // 너무 크면 컨테이너 크기에 맞게 스케일 조정 (비율 유지)
        let effectiveScale = currentScale;
        if (desiredWidth > maxWidth) {
            effectiveScale = (maxWidth / viewportBase.width);
            desiredWidth = maxWidth;
            desiredHeight = viewportBase.height * effectiveScale;
        }
         if (desiredHeight > maxHeight) {
             // 너비 기준으로 줄였는데도 높이가 크면 높이 기준으로 다시 계산
             effectiveScale = Math.min(effectiveScale, (maxHeight / viewportBase.height));
         }

        const scaledViewport = page.getViewport({ scale: effectiveScale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        // CSS max-width/height도 고려될 수 있으므로 스타일 직접 설정은 조심
        // canvas.style.width = `${scaledViewport.width}px`;
        // canvas.style.height = `${scaledViewport.height}px`;


        const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;
        pageNumInput.value = currentPageNum;

    } catch (error) {
        console.error(`페이지 ${num} 렌더링 오류:`, error);
        // 렌더링 오류 발생 시 사용자 알림 로직 추가 가능
    } finally {
        isPageRendering = false;
        canvas.style.opacity = '1';
        updateControlsState();
    }
}

// 컨트롤 버튼 상태 업데이트 함수
function updateControlsState() {
    if (!pdfDoc) return;
    const disableButtons = isPageRendering;

    prevPageBtn.disabled = (currentPageNum <= 1 || disableButtons);
    nextPageBtn.disabled = (currentPageNum >= totalPages || disableButtons);
    zoomOutBtn.disabled = (currentScale <= minScale || disableButtons);
    zoomInBtn.disabled = (currentScale >= maxScale || disableButtons);
    pageNumInput.disabled = disableButtons;
    pageNumInput.max = totalPages;
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
}

// 다음 페이지
function showNextPage() {
    if (currentPageNum >= totalPages || isPageRendering) return;
    currentPageNum++;
    renderPage(currentPageNum);
}

// 이전 페이지
function showPrevPage() {
    if (currentPageNum <= 1 || isPageRendering) return;
    currentPageNum--;
    renderPage(currentPageNum);
}

// 특정 페이지로 이동
function goToPage(num) {
    if (isPageRendering) return;
    const pageNumber = Math.max(1, Math.min(parseInt(num, 10), totalPages));
    if (pageNumber !== currentPageNum) {
        currentPageNum = pageNumber;
        renderPage(currentPageNum);
    } else {
        pageNumInput.value = currentPageNum;
    }
}

// 배율 변경
function changeZoom(newScale) {
    if (isPageRendering) return;
    // 스케일 변경 시 현재 스케일 값만 업데이트하고 리렌더링
    currentScale = Math.max(minScale, Math.min(newScale, maxScale));
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`; // 스케일 표시 즉시 업데이트
    renderPage(currentPageNum); // 변경된 스케일로 현재 페이지 다시 그림
}

// 확대/축소 함수
function zoomIn() { changeZoom(currentScale + zoomStep); }
function zoomOut() { changeZoom(currentScale - zoomStep); }

// 전체 화면 토글 함수
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        viewerContainer.requestFullscreen().catch(err => console.error("Fullscreen request failed:", err));
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// 페이지 번호 입력 처리 함수
function handlePageInput(e) {
    const requestedPage = parseInt(e.target.value, 10);
    if (!isNaN(requestedPage)) {
        goToPage(requestedPage);
    } else {
        e.target.value = currentPageNum;
    }
}

// 터치 환경 컨트롤 관리 함수
function showControlsAndStartTimer() {
    viewerContainer.classList.add('controls-visible');
    clearTimeout(hideControlsTimer);
    hideControlsTimer = setTimeout(() => {
        viewerContainer.classList.remove('controls-visible');
    }, controlsTimeoutDuration);
}
function hideControlsImmediately() {
    clearTimeout(hideControlsTimer);
    viewerContainer.classList.remove('controls-visible');
}

// 초기 PDF 로드 및 설정 함수
async function loadPdfAndSetup() {
    isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(hover: none)').matches);

    try {
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        pageCountSpan.textContent = totalPages;
        pageNumInput.max = totalPages;

        // 초기 첫 페이지 렌더링
        await renderPage(currentPageNum);
        updateControlsState();

        // 이벤트 리스너 연결
        prevPageBtn.addEventListener('click', showPrevPage);
        nextPageBtn.addEventListener('click', showNextPage);
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        pageNumInput.addEventListener('change', handlePageInput);
        pageNumInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') { handlePageInput(e); e.target.blur(); }
        });

        // 키보드 네비게이션
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === pageNumInput || isPageRendering) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); showPrevPage(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); showNextPage(); }
            else if (e.key === '+') { e.preventDefault(); zoomIn(); }
            else if (e.key === '-') { e.preventDefault(); zoomOut(); }
            else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
        });

        // 터치 환경 이벤트 리스너
        if (isTouchDevice) {
            console.log("터치 장치 감지됨 - 터치 이벤트 리스너 활성화");
            viewerContainer.addEventListener('click', (e) => {
                if (e.target === viewerContainer) { showControlsAndStartTimer(); }
            });
            canvasContainer.addEventListener('click', (e) => {
                if (e.target === canvas) {
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

    } catch (error) {
        // 오류 처리 로깅 강화
        console.error('PDF 로드 중 상세 오류:', error);
        console.error('오류 이름:', error.name);
        console.error('오류 메시지:', error.message);
        controlsDiv.style.display = 'none';
        if(canvasContainer) {
            canvasContainer.innerHTML = `<p style="color: red; padding: 20px;">오류: PDF 로드 실패. 콘솔(F12 또는 원격 디버깅)에서 상세 오류를 확인하세요. (오류: ${error.name || '알 수 없음'})</p>`;
        }
    }
}

// 실행
loadPdfAndSetup();
