document.addEventListener("DOMContentLoaded", function () {
  // Add this near the top of the DOMContentLoaded handler
  let lastSavedCode = "";
  const codeEditor = document.getElementById("codeEditor");
  const unsavedIndicator = document.getElementById("unsavedIndicator");
  const executionHistory = [];

  codeEditor.addEventListener("input", function () {
    if (this.value !== lastSavedCode) {
      unsavedIndicator.classList.remove("hidden");
    } else {
      unsavedIndicator.classList.add("hidden");
    }
  });

  // Load sample codes
  fetch("/static/sample_codes.json")
    .then((response) => response.json())
    .then((sampleCodes) => {
      const select = document.getElementById("sampleCodeSelect");
      sampleCodes.forEach((sample, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = sample.programName;
        select.appendChild(option);
      });

      // Add change event listener
      select.addEventListener("change", async function () {
        if (this.value === "") return;

        const sample = sampleCodes[this.value];
        const newCode = sample.program.join("\n");

        // Check if there are unsaved changes before loading new sample
        if (codeEditor.value !== lastSavedCode) {
          if (!confirm("You have unsaved changes. Load sample program anyway?")) {
            this.value = ""; // Reset select to empty if user cancels
            return;
          }
        }

        // Set code in editor and update saved state
        codeEditor.value = newCode;
        lastSavedCode = codeEditor.value;
        unsavedIndicator.classList.remove("hidden");

        try {
          // Reset RAM first
          await fetch("/api/reset", { method: "POST" });

          // Set up RAM
          for (const ramSetup of sample.ramSetup) {
            const response = await fetch("/api/set-ram", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address: ramSetup.address,
                label: ramSetup.label || "",
                value: ramSetup.value || "",
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to set RAM at address ${ramSetup.address}`);
            }
          }

          // Update the RAM table display
          const rows = ramTable.getElementsByTagName("tr");
          for (const row of rows) {
            const addr = row.cells[0].textContent;
            const ramSetup = sample.ramSetup.find((setup) => setup.address === addr);
            if (ramSetup) {
              row.cells[1].textContent = ramSetup.label || "NULL";
              row.cells[2].textContent = ramSetup.value || "NULL";
            } else {
              row.cells[1].textContent = "NULL";
              row.cells[2].textContent = "NULL";
            }
          }
        } catch (error) {
          console.error("Error setting up RAM:", error);
          alert("Failed to set up RAM values");
        }
      });
    })
    .catch((error) => console.error("Error loading sample codes:", error));

  // Modify RAM table initialization
  const ramTable = document.getElementById("ramTable").getElementsByTagName("tbody")[0];
  for (let i = 0; i < 256; i++) {
    const addr = i.toString(16).toUpperCase().padStart(2, "0");
    const row = ramTable.insertRow();
    row.insertCell(0).textContent = addr;
    row.cells[0].classList.add("px-4", "py-1");

    // Make label cell editable
    const labelCell = row.insertCell(1);
    labelCell.textContent = "NULL";
    labelCell.setAttribute("contenteditable", "true");
    labelCell.classList.add("cursor-pointer", "hover:bg-gray-600", "px-4", "py-1", "outline-none");

    // Make value cell editable
    const valueCell = row.insertCell(2);
    valueCell.textContent = "NULL";
    valueCell.setAttribute("contenteditable", "true");
    valueCell.classList.add("cursor-pointer", "hover:bg-gray-600", "px-4", "py-1", "outline-none");

    // Add event listeners for both cells
    [labelCell, valueCell].forEach((cell) => {
      // Store original value when starting to edit
      cell.addEventListener("focus", function () {
        this.dataset.originalValue = this.textContent;
      });

      cell.addEventListener("blur", async function () {
        let newValue = this.textContent.trim();
        if (newValue === "") {
          this.textContent = "NULL";
          newValue = "NULL";
        }

        const row = this.parentElement;
        const address = row.cells[0].textContent;
        const label = row.cells[1].textContent;
        const value = row.cells[2].textContent;
        let isValid = true;

        // Validate value (hex number between 00 and FF)
        if (this === valueCell && newValue !== "NULL") {
          const valueRegex = /^[0-9A-Fa-f]{1,2}$/;
          if (!valueRegex.test(newValue)) {
            alert("Value must be a hexadecimal number between 00 and FF");
            this.textContent = this.dataset.originalValue;
            isValid = false;
          } else {
            // Convert to decimal to check range
            const decimalValue = parseInt(newValue, 16);
            if (decimalValue < 0 || decimalValue > 255) {
              alert("Value must be between 00 and FF");
              this.textContent = this.dataset.originalValue;
              isValid = false;
            } else {
              // Pad with leading zero if necessary and convert to uppercase
              this.textContent = newValue.toUpperCase().padStart(2, "0");
            }
          }
        }

        // Validate label (alphanumeric and underscore only)
        if (this === labelCell && newValue !== "NULL") {
          const labelRegex = /^[a-zA-Z0-9_]+$/;
          if (!labelRegex.test(newValue)) {
            alert("Label must contain only letters, numbers, and underscores");
            this.textContent = this.dataset.originalValue;
            isValid = false;
          }
        }

        if (newValue === "") {
          this.textContent = "NULL";
        }

        if (isValid && newValue !== this.dataset.originalValue) {
          try {
            const response = await fetch("/api/set-ram", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address,
                label: label === "NULL" ? "" : label,
                value: value === "NULL" ? "" : value,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to update RAM value");
            }
          } catch (error) {
            alert(error.message);
            this.textContent = this.dataset.originalValue;
          }
        }
      });

      // Handle keyboard events
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          this.textContent = this.dataset.originalValue;
          this.blur();
        } else if (e.key === "Enter") {
          e.preventDefault();
          this.blur();
        }
      });
    });
  }

  // Event Listeners
  document.getElementById("submitCode").addEventListener("click", submitCode);
  document.getElementById("step").addEventListener("click", step);
  document.getElementById("run").addEventListener("click", runAll);
  document.getElementById("reset").addEventListener("click", reset);
  document.getElementById("aiAssist").addEventListener("click", async function () {
    const code = document.getElementById("codeEditor").value;
    document.getElementById("aiLoading").classList.remove("hidden");

    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
          history: executionHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Render markdown to HTML
      document.getElementById("aiExplanation").innerHTML = marked.parse(data.explanation);
      document.getElementById("aiModal").classList.remove("hidden");
    } catch (error) {
      alert("Error getting AI assistance: " + error.message);
    } finally {
      document.getElementById("aiLoading").classList.add("hidden");
    }
  });

  // Functions
  async function submitCode() {
    const code = document.getElementById("codeEditor").value;
    const response = await fetch("/api/submit-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    lastSavedCode = code; // Update saved code
    unsavedIndicator.classList.add("hidden"); // Hide indicator
    updateUI({});

    // Update program instructions in visualization modal
    updateProgramInstructions(code);
  }

  function updateProgramInstructions(code) {
    const programInstructions = document.getElementById("programInstructions");
    programInstructions.innerHTML = ""; // Clear existing content

    if (!code.trim()) {
      programInstructions.innerHTML = `
                <div class="text-gray-400 text-center pt-4">
                    Submit a program to see its instructions here
                </div>
            `;
      return;
    }

    // Parse the code and create instruction elements
    const lines = code.split("\n");
    let currentAddress = 0;

    lines.forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith(";")) return;

      const parts = line.split(/\s+/);
      let instruction, operand;

      if (parts[0].endsWith(":")) {
        instruction = parts[1];
        operand = parts[2];
      } else {
        instruction = parts[0];
        operand = parts[1];
      }

      if (!instruction) return;

      // Create instruction element
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "mb-6";

      // Add instruction header
      const header = document.createElement("h4");
      header.className = "text-white text-lg font-medium mb-2";
      header.textContent = `${instruction.toUpperCase()} ${operand || ""}`;
      instructionDiv.appendChild(header);

      // Add instruction steps
      const steps = document.createElement("ol");
      steps.className = "list-decimal list-inside text-gray-300 space-y-1 ml-2";

      // Add common fetch cycle steps with click handlers
      const fetchSteps = [
        { text: "PC → MAR", components: ["pc", "mar"], bus: ["mar-to-main"] },
        {
          text: "Memory[MAR] → MDR, PC + 1 → PC",
          components: ["mar", "mdr", "pc"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
        { text: "MDR → IR", components: ["mdr", "ir"], bus: ["mdr-to-main", "ir-to-main"] },
      ];

      fetchSteps.forEach((step) => {
        const li = document.createElement("li");
        li.className = "cursor-pointer hover:text-white transition-colors";
        li.textContent = step.text;
        li.onclick = () => highlightComponents(step.components, step.bus);
        steps.appendChild(li);
      });

      // Add instruction-specific steps
      const instructionSteps = getInstructionSteps(instruction.toUpperCase());
      instructionSteps.forEach((step) => {
        const li = document.createElement("li");
        li.className = "cursor-pointer hover:text-white transition-colors";
        li.textContent = step.text;
        li.onclick = () => highlightComponents(step.components, step.bus);
        steps.appendChild(li);
      });

      instructionDiv.appendChild(steps);
      programInstructions.appendChild(instructionDiv);
    });
  }

  function getInstructionSteps(instruction) {
    const steps = {
      LDA: [
        { text: "IR(address) → MAR", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main"] },
        {
          text: "Memory[MAR] → MDR",
          components: ["mar", "mdr"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
        { text: "MDR → ACC", components: ["mdr", "acc"], bus: ["mdr-to-main", "acc-to-main"] },
      ],
      ADD: [
        { text: "IR(address) → MAR", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main"] },
        {
          text: "Memory[MAR] → MDR",
          components: ["mar", "mdr"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
        { text: "ACC → B", components: ["acc", "b"], bus: ["acc-to-main", "b-to-main"] },
        { text: "MDR + B → ACC", components: ["mdr", "b", "acc"], bus: ["mdr-to-main", "b-to-main", "acc-to-main"] },
      ],
      SUB: [
        { text: "IR(address) → MAR", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main"] },
        {
          text: "Memory[MAR] → MDR",
          components: ["mar", "mdr"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
        { text: "ACC → B", components: ["acc", "b"], bus: ["acc-to-main", "b-to-main"] },
        { text: "B - MDR → ACC", components: ["b", "mdr", "acc"], bus: ["b-to-main", "mdr-to-main", "acc-to-main"] },
      ],
      STA: [
        { text: "IR(address) → MAR", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main"] },
        { text: "ACC → MDR", components: ["acc", "mdr"], bus: ["acc-to-main", "mdr-to-main"] },
        {
          text: "MDR → Memory[MAR]",
          components: ["mdr", "mar"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
      ],
      BRZ: [
        {
          text: "If ACC = 0: IR(address) → PC",
          components: ["acc", "ir", "pc"],
          bus: ["acc-to-main", "ir-to-main", "mar-to-main"],
        },
      ],
      BRP: [
        { text: "If NF = 0: IR(address) → PC", components: ["nf", "ir", "pc"], bus: ["ir-to-main", "mar-to-main"] },
      ],
      HLT: [{ text: "Stop execution", components: ["ir"], bus: [] }],
    };
    return steps[instruction] || [];
  }

  function highlightComponents(components, busSegments) {
    // Reset all components and bus segments
    const allComponents = ["pc", "mar", "mdr", "ir", "acc", "b", "nf"];
    const allBusSegments = [
      "mar-to-main",
      "ram-to-mdr-horizontal",
      "ram-to-mdr-vertical-up",
      "ram-to-mdr-vertical-down",
      "mdr-to-main",
      "ir-to-main",
      "acc-to-main",
      "b-to-main",
    ];

    // Reset colors
    allComponents.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#4A1E3F"; // Original color
      }
    });

    allBusSegments.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#D9D9D9"; // Original color
      }
    });

    // Highlight active components and bus segments
    components.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#6B2E5A"; // Highlighted component color
      }
    });

    busSegments.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#4A90E2"; // Highlighted bus color
      }
    });
  }

  async function step() {
    const response = await fetch("/api/step", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error);
      return;
    }

    // Record step in history
    executionHistory.push({
      pc: data.pc,
      acc: data.acc,
      b: data.b,
      mar: data.mar,
      mdr: data.mdr,
      ir: data.ir,
      nf: data.nf,
      instruction: data.instruction,
      comments: data.comments,
    });

    updateUI(data);
  }

  async function runAll() {
    const response = await fetch("/api/run", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error);
      return;
    }
    if (data.results.length > 0) {
      updateUI(data.results[data.results.length - 1]);
    }
  }

  async function reset() {
    await fetch("/api/reset", {
      method: "POST",
    });
    lastSavedCode = codeEditor.value; // Update saved code
    unsavedIndicator.classList.add("hidden"); // Hide indicator
    updateUI({
      pc: "",
      acc: "",
      b: "",
      mar: "",
      mdr: "",
      ir: "",
      nf: "",
      comments: "",
      instruction: "",
    });
    // Reset RAM table
    const rows = ramTable.getElementsByTagName("tr");
    for (let row of rows) {
      row.cells[1].textContent = "NULL";
      row.cells[2].textContent = "NULL";
    }
  }

  function updateUI(data) {
    // Helper function to update register with glow effect
    const updateRegister = (id, newValue) => {
      const element = document.getElementById(id);
      const oldValue = element.textContent;
      element.textContent = newValue || "";

      // Add glow effect if value changed
      if (oldValue !== newValue && newValue) {
        const registerDiv = element.closest(".register");
        registerDiv.classList.add("register-glow");

        // Remove glow effect after animation
        setTimeout(() => {
          registerDiv.classList.remove("register-glow");
        }, 1000);
      }
    };

    // Update registers with glow effect
    updateRegister("pc", data.pc);
    updateRegister("acc", data.acc);
    updateRegister("b", data.b);
    updateRegister("mar", data.mar);
    updateRegister("mdr", data.mdr);
    updateRegister("ir", data.ir);
    updateRegister("nf", data.nf);
    updateRegister("instruction", data.instruction);
    updateRegister("comments", data.comments);

    // Update RAM if provided
    if (data.ram) {
      const rows = ramTable.getElementsByTagName("tr");
      for (let row of rows) {
        const addr = row.cells[0].textContent;
        if (data.ram[addr]) {
          row.cells[1].textContent = data.ram[addr].label;
          row.cells[2].textContent = data.ram[addr].value;
        }
      }
    }
  }

  // Help modal functionality
  const helpButton = document.getElementById("helpButton");
  const helpModal = document.getElementById("helpModal");
  const closeHelp = document.getElementById("closeHelp");

  helpButton.addEventListener("click", () => {
    helpModal.classList.remove("hidden");
  });

  closeHelp.addEventListener("click", () => {
    helpModal.classList.add("hidden");
  });

  // Close modal when clicking outside
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
      helpModal.classList.add("hidden");
    }
  });

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
      helpModal.classList.add("hidden");
    }
  });

  // Add modal close handlers
  document.getElementById("closeAi").addEventListener("click", () => {
    document.getElementById("aiModal").classList.add("hidden");
  });

  document.getElementById("aiModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("aiModal")) {
      document.getElementById("aiModal").classList.add("hidden");
    }
  });

  // Visualization modal functionality
  const visualizeBtn = document.getElementById("visualizeBtn");
  const visualizeModal = document.getElementById("visualizeModal");
  const closeVisualize = document.getElementById("closeVisualize");

  visualizeBtn.addEventListener("click", () => {
    visualizeModal.classList.remove("hidden");
  });

  closeVisualize.addEventListener("click", () => {
    visualizeModal.classList.add("hidden");
  });

  visualizeModal.addEventListener("click", (e) => {
    if (e.target === visualizeModal) {
      visualizeModal.classList.add("hidden");
    }
  });

  // Add Escape key handler for visualize modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !visualizeModal.classList.contains("hidden")) {
      visualizeModal.classList.add("hidden");
    }
  });
});
