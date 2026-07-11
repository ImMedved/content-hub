function ScrollToTopButton() {
    function handleScrollTop() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return (
        <button className="scroll-top-button" type="button" onClick={handleScrollTop}>
            Top
        </button>
    );
}

export default ScrollToTopButton;
