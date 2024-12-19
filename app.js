document.addEventListener("DOMContentLoaded", () => {
    const budgetInput = document.getElementById("budget");
    const industrySelect = document.getElementById("industry");
    const channelContainer = document.getElementById("channel-selection");
    const mediaPlanTable = document.getElementById("media-plan").querySelector("tbody");
    const chartCanvas = document.getElementById("chart");
    let chart;

    let data = [];
    let channels = [];
    let savedSelections = {}; // Store selections for each industry

    // Load CSV data
    Papa.parse("data.csv", {
        download: true,
        header: true,
        complete: function (results) {
            data = results.data;
            populateIndustryDropdown();

            // Automatically select and display channels for the first industry
            const firstIndustry = data[0]?.Industry; // Use the first industry in the data
            if (firstIndustry) {
                industrySelect.value = firstIndustry; // Set dropdown to the first industry
                updateChannelSelection(); // Display channels for the first industry
            }
        },
    });

    function populateIndustryDropdown() {
        const industries = [...new Set(data.map(row => row.Industry))];
        industries.forEach(industry => {
            const option = document.createElement("option");
            option.value = industry;
            option.textContent = industry;
            industrySelect.appendChild(option);
        });
    }

    industrySelect.addEventListener("change", updateChannelSelection);

    function updateChannelSelection() {
        const selectedIndustry = industrySelect.value;

        // If there are no saved selections for this industry, initialize it
        if (!savedSelections[selectedIndustry]) {
            savedSelections[selectedIndustry] = {};
        }

        // Filter channels based on the selected industry
        channels = data.filter(row => row.Industry === selectedIndustry);

        // Clear the current channel container and rebuild the channels
        channelContainer.innerHTML = "";

        // Create new channels with saved state if any
        channels.forEach(channel => {
            const div = document.createElement("div");
            div.classList.add("channel");

            const label = document.createElement("label");
            label.textContent = channel.Channel;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = savedSelections[selectedIndustry][channel.Channel]?.checked || false; // Use saved state or false
            checkbox.addEventListener("change", () => togglePercentageInput(checkbox, div, channel)); // Enable/disable percentage input

            const percentageInput = document.createElement("input");
            percentageInput.type = "number";
            percentageInput.placeholder = "%";
            percentageInput.disabled = !checkbox.checked; // Disable initially if checkbox is not checked
            percentageInput.value = savedSelections[selectedIndustry][channel.Channel]?.percentage || ""; // Restore percentage value if available
            percentageInput.addEventListener("input", () => updateMediaPlan());
            percentageInput.addEventListener("focusout", () => handleFocusOut(percentageInput)); // Retain value when clicked off

            const costLabel = document.createElement("span");
            costLabel.textContent = "$0";

            div.appendChild(checkbox);
            div.appendChild(label);
            div.appendChild(percentageInput);
            div.appendChild(costLabel);

            channelContainer.appendChild(div);
        });

        // Recalculate the media plan and update the chart
        updateMediaPlan();
    }

    function togglePercentageInput(checkbox, div, channel) {
        const percentageInput = div.querySelector("input[type='number']");

        // Enable/disable the percentage input based on checkbox
        if (checkbox.checked) {
            percentageInput.disabled = false;
        } else {
            percentageInput.disabled = true;
        }

        // Save the checkbox and percentage state
        const selectedIndustry = industrySelect.value;
        if (!savedSelections[selectedIndustry]) {
            savedSelections[selectedIndustry] = {};
        }
        savedSelections[selectedIndustry][channel.Channel] = {
            checked: checkbox.checked,
            percentage: percentageInput.value || "",
        };

        // Update media plan
        updateMediaPlan();
    }

    // Prevent clearing input when clicked off
    function handleFocusOut(inputField) {
        const inputValue = inputField.value.trim();
        if (inputValue !== "") {
            inputField.value = inputValue; // Retain the value when clicked off
        }
    }

    function updateMediaPlan() {
        const budget = parseFloat(budgetInput.value) || 0;
        mediaPlanTable.innerHTML = "";

        let totalMetrics = [];
        const channelElements = channelContainer.querySelectorAll(".channel");

        channelElements.forEach((channelElement, index) => {
            const checkbox = channelElement.querySelector("input[type='checkbox']");
            const percentageInput = channelElement.querySelector("input[type='number']");
            const costLabel = channelElement.querySelector("span");

            // Only calculate if the channel is checked
            if (checkbox.checked) {
                const percentage = parseFloat(percentageInput.value) || 0;
                const cost = (percentage / 100) * budget;
                costLabel.textContent = `$${cost.toLocaleString()}`;

                const channelData = channels[index];
                const CPC = parseFloat(channelData.CPC);
                const CTR = parseFloat(channelData.CTR) / 100; // CTR now comes from CSV
                const convRate = parseFloat(channelData.ConvRate) / 100;

                // Recalculate the metrics
                const impressions = cost / (CPC * CTR); // Impressions = Cost / (CPC * CTR)
                const clicks = cost / CPC; // Clicks = Cost / CPC
                const CPM = cost / impressions * 1000; // Clicks = Cost / CPC
                const conversions = clicks * convRate;
                const costPerConv = conversions > 0 ? cost / conversions : 0;

                totalMetrics.push({ channel: channelData.Channel, impressions, clicks, cost, conversions });

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${channelData.Channel}</td>
                    <td>${Math.round(impressions).toLocaleString()}</td>
                    <td>${Math.round(clicks).toLocaleString()}</td>
                    <td>${(CTR * 100).toFixed(2)}%</td> <!-- CTR in % -->
                    <td>$${CPC.toFixed(2)}</td> <!-- CPC in $ -->
                    <td>$${CPM.toFixed(2)}</td> <!-- CPM in $ -->
                    <td>${conversions.toFixed(2)}</td> <!-- Conversions with decimals -->
                    <td>${(convRate * 100).toFixed(2)}%</td> <!-- Conversion Rate in % -->
                    <td>$${cost.toLocaleString()}</td> <!-- Cost in $ -->
                    <td>$${costPerConv.toFixed(2)}</td> <!-- Cost per Conversion in $ -->
                `;
                mediaPlanTable.appendChild(row);
            }
        });

        updateChart(totalMetrics);
    }

    function updateChart(metrics) {
        const labels = metrics.map(metric => metric.channel);
        const impressions = metrics.map(metric => metric.impressions);
        const clicks = metrics.map(metric => metric.clicks);

        if (chart) chart.destroy();

        chart = new Chart(chartCanvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Impressions",
                        data: impressions,
                        backgroundColor: "rgba(75, 192, 192, 0.6)",
                        yAxisID: "y",
                    },
                    {
                        label: "Clicks",
                        data: clicks,
                        backgroundColor: "rgba(153, 102, 255, 0.6)",
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                scales: {
                    y: { type: "linear", position: "left" },
                    y1: { type: "linear", position: "right" },
                },
            },
        });
    }

    // Event listener for budget input change
    budgetInput.addEventListener("input", () => updateMediaPlan());
});
