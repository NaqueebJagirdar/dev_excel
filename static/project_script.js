document.querySelectorAll("select").forEach(select => {
    const updateStyle = () => {
        const value = select.value.toLowerCase();
        select.setAttribute("data-value", value);
    };

    select.addEventListener("change", updateStyle);
    updateStyle(); // Set initial style
});
