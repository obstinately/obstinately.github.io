// pdf.mjs에서 필요한 객체 가져오기
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// 워커 경로 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

// --- 설정 변수 ---
const pdfPath = '경기도메뉴얼-2023.pdf';
const initialScale = 1.5;
const zoomStep = 0.2;
const minScale = 0.4;
const maxScale = 4.0;
const animationDuration = 400; // ms, CSS transition 시간과 일치
// -----------------

// DOM 요소 가져오기
const viewerContainer = document.getElementById('viewer-container');
// --- 두 개의 캔버스 가져오기 ---
const canvas1 = document.getElementById('pdf-canvas-1');
const canvas2 = document.getElementById('pdf-canvas-2');
const ctx1 = canvas1.getContext('2d');
const ctx2 = canvas2.getContext('2d');
// -----------------------------
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
let isAnimating = false; // 애니메이션 진행 중 플래그 추가

// --- 활성/비활성 캔버스 관리 ---
let activeCanvas = canvas1;
let inactiveCanvas = canvas2;
let activeCtx = ctx1;
let inactiveCtx = ctx2;
// -----------------------------

// 페이지 렌더링 함수 (이제 대상 캔버스와 컨텍스트를 받음)
async function renderPage(num, targetCanvas, targetCtx) {
    if (!pdfDoc) return; // PDF 로드 확인
    isPageRendering = true; // 렌더링 시작

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: currentScale });

        // 캔버스 크기 설정 (중요: CSS max-width/height 고려)
        const cssWidth = targetCanvas.clientWidth; // CSS에 의해 결정된 너비
        const cssHeight = targetCanvas.clientHeight; // CSS에 의해 결정된 높이
        const scaleX = cssWidth / viewport.width;
        const scaleY = cssHeight / viewport.height;
        const effectiveScale = Math.min(scaleX, scaleY, 1); // CSS 크기 내 맞춤 또는 원본(최대 1)

        const scaledViewport = page.getViewport({ scale: currentScale * effectiveScale });

        targetCanvas.height = scaledViewport.height;
        targetCanvas.width = scaledViewport.width;
        // CSS 크기는 max-width/height로 제어되므로 별도 설정 불필요

        // 페이지 렌더링
        const renderContext = {
            canvasContext: targetCtx,
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;

        // 렌더링 완료 후 상태 업데이트 (현재 페이지 번호 등은 애니메이션 종료 후)

    } catch (error) {
        console.error(`페이지 ${num} 렌더링 오류:`, error);
        // 오류 발생 시 사용자 알림 필요 시 추가
    } finally {
        isPageRendering = false; // 렌더링 종료
    }
}

// 컨트롤 버튼 상태 업데이트 함수 (이전과 동일)
function updateControlsState() {
    if (!pdfDoc) return;
    prevPageBtn.disabled = (currentPageNum <= 1 || isAnimating);
    nextPageBtn.disabled = (currentPageNum >= totalPages || isAnimating);
    zoomOutBtn.disabled = (currentScale <= minScale || isAnimating);
    zoomInBtn.disabled = (currentScale >= maxScale || isAnimating);
    pageNumInput.max = totalPages;
    pageNumInput.disabled = isAnimating; // 애니메이션 중 입력 방지
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
}

// --- 애니메이션 종료 후 처리 함수 ---
function onAnimationEnd() {
    isAnimating = false; // 애니메이션 종료 플래그

    // 활성/비활성 캔버스 역할 교체
    const tempCanvas = activeCanvas;
    activeCanvas = inactiveCanvas;
    inactiveCanvas = tempCanvas;
    const tempCtx = activeCtx;
    activeCtx = inactiveCtx;
    inactiveCtx = tempCtx;

    // 화면 밖으로 나간 (이제 비활성인) 캔버스 위치 초기화 (다음 애니메이션 준비)
    // 위치는 애니메이션 방향에 따라 다름 (next는 오른쪽, prev는 왼쪽으로 숨김)
    // inactiveCanvas.style.transition = 'none'; // 위치 변경 시 애니메이션 방지
    // inactiveCanvas.style.left = '100%'; // 또는 '-100%'
    // setTimeout(() => { inactiveCanvas.style.transition = ''; }, 0); // 다음 프레임에 transition 복구

    updateControlsState(); // 버튼 상태 업데이트
    pageNumInput.value = currentPageNum; // 페이지 번호 입력 필드 업데이트
}
// -----------------------------------

// 다음 페이지 (슬라이드 애니메이션 추가)
async function showNextPage() {
    if (currentPageNum >= totalPages || isAnimating || isPageRendering) return;

    isAnimating = true; // 애니메이션 시작
    updateControlsState(); // 버튼 비활성화

    const nextPageNum = currentPageNum + 1;

    // 1. 다음 페이지를 비활성 캔버스에 렌더링
    inactiveCanvas.style.opacity = '0'; // 렌더링 중 잠시 숨김 (선택적)
    await renderPage(nextPageNum, inactiveCanvas, inactiveCtx);
    inactiveCanvas.style.opacity = '1';

    // 2. 비활성 캔버스를 오른쪽에 배치 (애니메이션 시작 위치)
    inactiveCanvas.style.transition = 'none'; // 위치 변경 시 애니메이션 방지
    inactiveCanvas.style.left = '100%';
    // inactiveCanvas.offsetHeight; // Reflow 강제 (브라우저 최적화 방지)
    await new Promise(resolve => setTimeout(resolve, 0)); // 다음 프레임까지 잠시 대기
    inactiveCanvas.style.transition = ''; // 트랜지션 복구


    // 3. 슬라이드 애니메이션 시작
    activeCanvas.style.left = '-100%';  // 현재 캔버스 왼쪽으로 슬라이드 아웃
    inactiveCanvas.style.left = '0%';   // 다음 캔버스 오른쪽에서 슬라이드 인

    // 4. 현재 페이지 번호 업데이트 (애니메이션 중에 반영)
    currentPageNum = nextPageNum;
    // 페이지 입력 필드는 애니메이션 끝나고 업데이트 (onAnimationEnd)

    // 5. 애니메이션 종료 감지 (transitionend 이벤트 사용)
    // 여러 속성이 변할 수 있으므로 한 번만 실행되도록 처리
    let transitionEnded = false;
    activeCanvas.addEventListener('transitionend', function handler(event) {
        // left 속성 애니메이션 종료 시에만 처리
        if (event.propertyName === 'left' && !transitionEnded) {
            transitionEnded = true;
            activeCanvas.removeEventListener('transitionend', handler);
            onAnimationEnd(); // 애니메이션 종료 후 처리 함수 호출
        }
    }, { once: true }); // 한번만 실행되도록 하는 옵션은 불안정할 수 있어, 수동 제거 권장
}


// 이전 페이지 (슬라이드 애니메이션 추가)
async function showPrevPage() {
    if (currentPageNum <= 1 || isAnimating || isPageRendering) return;

    isAnimating = true;
    updateControlsState();

    const prevPageNum = currentPageNum - 1;

    // 1. 이전 페이지를 비활성 캔버스에 렌더링
    inactiveCanvas.style.opacity = '0';
    await renderPage(prevPageNum, inactiveCanvas, inactiveCtx);
    inactiveCanvas.style.opacity = '1';

    // 2. 비활성 캔버스를 왼쪽에 배치
    inactiveCanvas.style.transition = 'none';
    inactiveCanvas.style.left = '-100%';
    // inactiveCanvas.offsetHeight; // Reflow 강제
    await new Promise(resolve => setTimeout(resolve, 0));
    inactiveCanvas.style.transition = '';

    // 3. 슬라이드 애니메이션 시작
    activeCanvas.style.left = '100%';   // 현재 캔버스 오른쪽으로 슬라이드 아웃
    inactiveCanvas.style.left = '0%';    // 이전 캔버스 왼쪽에서 슬라이드 인

    // 4. 현재 페이지 번호 업데이트
    currentPageNum = prevPageNum;

    // 5. 애니메이션 종료 감지
    let transitionEnded = false;
    activeCanvas.addEventListener('transitionend', function handler(event) {
        if (event.propertyName === 'left' && !transitionEnded) {
            transitionEnded = true;
            activeCanvas.removeEventListener('transitionend', handler);
            onAnimationEnd();
        }
    }, { once: true });
}


// 특정 페이지로 이동 (애니메이션 없이 바로 렌더링)
function goToPage(num) {
    if (isAnimating || isPageRendering) return; // 동작 중이면 무시

    const pageNumber = Math.max(1, Math.min(parseInt(num, 10), totalPages));
    if (pageNumber !== currentPageNum) {
        // 현재 활성 캔버스에 바로 렌더링
        renderPage(pageNumber, activeCanvas, activeCtx).then(() => {
            currentPageNum = pageNumber;
            pageNumInput.value = currentPageNum;
            updateControlsState();
        });
    }
     pageNumInput.value = pageNumber; // 입력 필드 값 즉시 반영
}

// 배율 변경 (활성 캔버스에만 적용, 애니메이션 없음)
function changeZoom(newScale) {
     if (isAnimating || isPageRendering) return;
    currentScale = Math.max(minScale, Math.min(newScale, maxScale));
    // 현재 보이는 페이지만 다시 렌더링
    renderPage(currentPageNum, activeCanvas, activeCtx).then(() => {
         updateControlsState(); // 줌 버튼 상태 업데이트
    });
}

// 확대
function zoomIn() { changeZoom(currentScale + zoomStep); }
// 축소
function zoomOut() { changeZoom(currentScale - zoomStep); }

// 전체 화면 토글 (이전과 동일)
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        viewerContainer.requestFullscreen().catch(err => console.error(err));
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// 페이지 번호 입력 처리 (이전과 동일)
function handlePageInput(e) {
    const requestedPage = parseInt(e.target.value, 10);
    if (!isNaN(requestedPage)) {
        goToPage(requestedPage);
    } else {
        e.target.value = currentPageNum;
    }
}


// 초기 PDF 로드 및 설정 함수
async function loadPdfAndSetup() {
    try {
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        pageCountSpan.textContent = totalPages;
        pageNumInput.max = totalPages;

        // --- 초기 첫 페이지 렌더링 (활성 캔버스에) ---
        await renderPage(currentPageNum, activeCanvas, activeCtx);
        updateControlsState(); // 초기 버튼 상태 설정

        // --- 이벤트 리스너 연결 ---
        prevPageBtn.addEventListener('click', showPrevPage);
        nextPageBtn.addEventListener('click', showNextPage);
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        pageNumInput.addEventListener('change', handlePageInput);
        pageNumInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') { handlePageInput(e); e.target.blur(); }
        });

        // 키보드 네비게이션 (애니메이션 고려)
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === pageNumInput) return; // 입력 중 제외
             if (isAnimating) return; // 애니메이션 중 제외

            if (e.key === 'ArrowLeft') { e.preventDefault(); showPrevPage(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); showNextPage(); }
            else if (e.key === '+') { e.preventDefault(); zoomIn(); }
            else if (e.key === '-') { e.preventDefault(); zoomOut(); }
            else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen();}
        });

    } catch (error) {
        console.error('PDF 로드 오류:', error);
        // 오류 처리 (이전과 동일)
        document.getElementById('controls').style.display = 'none';
        const canvasContainer = document.getElementById('canvas-container');
        if(canvasContainer) canvasContainer.innerHTML = `<p style="color: red; padding: 20px;">오류: PDF 로드 실패. 경로(${pdfPath}) 확인 또는 콘솔(F12) 참조.</p>`;
    }
}

// --- 실행 ---
loadPdfAndSetup();
