// pdf.mjs에서 필요한 객체 가져오기
import * as pdfjsLib from '//mozilla.github.io/pdf.js/build/pdf.mjs';

// PDF.js 워커 경로 설정 (GitHub Pages 환경 고려, CDN 사용)
// 주의: 최신 pdf.mjs 버전에 맞는 워커 경로를 사용하는 것이 좋습니다.
// 만약 버전 불일치 오류 발생 시, 특정 버전 CDN 경로를 명시하거나
// pdf.worker.mjs 파일을 직접 다운로드 받아 프로젝트에 포함시키세요.
// 예: pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.mjs';

// --- 설정 변수 ---
const pdfPath = '경기도메뉴얼-2023.pdf'; // PDF 파일 경로 (index.html 기준)
const initialScale = 1.5; // 초기 배율 (1.0 = 100%)
const zoomStep = 0.2;     // 확대/축소 단계
const minScale = 0.4;     // 최소 배율
const maxScale = 4.0;     // 최대 배율
// -----------------

// DOM 요소 가져오기
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

// 상태 변수
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let currentScale = initialScale;
let isPageRendering = false; // 페이지 렌더링 중복 방지 플래그
let pageRenderPending = null; // 렌더링 대기 페이지 번호

// 페이지 렌더링 함수
async function renderPage(num) {
    if (isPageRendering) { // 이미 렌더링 중이면 요청 대기
        pageRenderPending = num;
        return;
    }
    if (!pdfDoc) return; // PDF 문서가 로드되지 않았으면 종료

    isPageRendering = true; // 렌더링 시작 플래그
    document.getElementById('pdf-canvas').style.opacity = '0.5'; // 로딩 중 시각 효과

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: currentScale });

        // Canvas 크기 및 스타일 설정
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.width = `${viewport.width}px`;

        // 페이지 렌더링
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // 렌더링 완료 후 상태 업데이트
        currentPageNum = num;
        pageNumInput.value = currentPageNum;
        updateControlsState(); // 버튼 상태 업데이트

    } catch (error) {
        console.error(`페이지 ${num} 렌더링 오류:`, error);
        alert(`페이지 ${num}을(를) 렌더링하는 중 오류가 발생했습니다.`);
    } finally {
        isPageRendering = false; // 렌더링 종료 플래그
        document.getElementById('pdf-canvas').style.opacity = '1'; // 로딩 효과 제거
        // 렌더링 대기 중인 페이지가 있으면 즉시 렌더링
        if (pageRenderPending !== null) {
            const pendingPage = pageRenderPending;
            pageRenderPending = null;
            renderPage(pendingPage);
        }
    }
}

// 컨트롤 버튼 상태 업데이트 함수
function updateControlsState() {
    if (!pdfDoc) return;
    // 페이지 이동 버튼
    prevPageBtn.disabled = (currentPageNum <= 1);
    nextPageBtn.disabled = (currentPageNum >= totalPages);
    // 확대/축소 버튼
    zoomOutBtn.disabled = (currentScale <= minScale);
    zoomInBtn.disabled = (currentScale >= maxScale);
    // 페이지 번호 입력
    pageNumInput.max = totalPages;
    // 줌 레벨 표시
    zoomLevelSpan.textContent = `${Math.round(currentScale * 100)}%`;
}

// 페이지 이동 함수 (범위 검사 포함)
function goToPage(num) {
    const pageNumber = Math.max(1, Math.min(parseInt(num, 10), totalPages));
    if (pageNumber !== currentPageNum && !isPageRendering) {
        renderPage(pageNumber);
    } else if (pageNumber !== currentPageNum && isPageRendering) {
         pageRenderPending = pageNumber; // 렌더링 중이면 대기열에 추가
    }
     pageNumInput.value = pageNumber; // 입력 필드 값 즉시 반영
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

// 배율 변경 및 재렌더링
function changeZoom(newScale) {
    currentScale = Math.max(minScale, Math.min(newScale, maxScale));
    renderPage(currentPageNum); // 현재 페이지 다시 렌더링
}

// 확대
function zoomIn() {
    changeZoom(currentScale + zoomStep);
}

// 축소
function zoomOut() {
    changeZoom(currentScale - zoomStep);
}

// 전체 화면 토글
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // 표준 API 시도
        viewerContainer.requestFullscreen().catch(err => {
            console.warn(`Fullscreen API 표준 실패: ${err.message}`);
            // 접두사 포함 API 시도 (오래된 브라우저 호환성)
            if (viewerContainer.webkitRequestFullscreen) { /* Safari, Chrome */
                viewerContainer.webkitRequestFullscreen();
            } else if (viewerContainer.msRequestFullscreen) { /* IE11 */
                viewerContainer.msRequestFullscreen();
            } else {
                 alert(`전체 화면 모드를 시작할 수 없습니다: ${err.message}`);
            }
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari, Chrome */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
    }
}

// 페이지 번호 입력 처리
function handlePageInput(e) {
    const requestedPage = parseInt(e.target.value, 10);
    if (!isNaN(requestedPage)) {
        goToPage(requestedPage);
    } else {
        // 잘못된 입력 시 현재 페이지로 복원
        e.target.value = currentPageNum;
    }
}

// 초기 PDF 로드 및 설정 함수
async function loadPdfAndSetup() {
    try {
        // PDF 문서 로딩 시작
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        // 총 페이지 수 표시 및 입력 필드 설정
        pageCountSpan.textContent = totalPages;
        pageNumInput.max = totalPages;

        // 첫 페이지 렌더링
        renderPage(currentPageNum); // 초기 페이지(1) 렌더링

        // --- 이벤트 리스너 연결 ---
        prevPageBtn.addEventListener('click', showPrevPage);
        nextPageBtn.addEventListener('click', showNextPage);
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        // 페이지 번호 입력 (변경 및 엔터키)
        pageNumInput.addEventListener('change', handlePageInput);
        pageNumInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handlePageInput(e);
                e.target.blur(); // 엔터 후 포커스 해제
            }
        });

        // 키보드 네비게이션 (좌/우 화살표)
        document.addEventListener('keydown', (e) => {
            // 입력 필드에 포커스가 있을 때는 페이지 넘김 방지
            if (document.activeElement === pageNumInput) return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault(); // 기본 스크롤 동작 방지
                showPrevPage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                showNextPage();
            } else if (e.key === '+') { // 확대 (+)
                 e.preventDefault();
                 zoomIn();
            } else if (e.key === '-') { // 축소 (-)
                 e.preventDefault();
                 zoomOut();
            } else if (e.key === 'f' || e.key === 'F') { // 전체화면 (F)
                 e.preventDefault();
                 toggleFullscreen();
            }
        });

        // 창 크기 변경 시 리렌더링 (배율 유지) - 선택 사항
        // let resizeTimeout;
        // window.addEventListener('resize', () => {
        //     clearTimeout(resizeTimeout);
        //     resizeTimeout = setTimeout(() => renderPage(currentPageNum), 150);
        // });

    } catch (error) {
        console.error('PDF 로드 오류:', error);
        // 사용자에게 오류 메시지 표시
        const controlsDiv = document.getElementById('controls');
        const canvasContainer = document.getElementById('canvas-container');
        if (controlsDiv) controlsDiv.style.display = 'none'; // 오류 시 컨트롤 숨김
        if (canvasContainer) {
            canvasContainer.innerHTML = `<p style="color: red; padding: 20px;">오류: PDF 파일(${pdfPath})을 로드할 수 없습니다. 파일 경로 및 상태를 확인하거나 콘솔(F12)을 참조하세요.</p>`;
            canvasContainer.style.backgroundColor = '#fff';
            canvasContainer.style.height = 'auto';
        }
        alert(`PDF 로딩 실패! 파일 경로를 확인하거나 개발자 콘솔(F12)을 보세요.`);
    }
}

// --- 실행 ---
loadPdfAndSetup(); // PDF 로드 및 뷰어 설정 시작
