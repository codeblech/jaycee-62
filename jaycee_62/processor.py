class ProcessorSimulator:
    def __init__(self):
        self.reset()

    def reset(self):
        self.ins_counter = 0
        self.pc_counter = 0
        self.acc_value = 0
        self.b_value = 0
        self.nf_value = 0
        self.instructions = []
        self.ram = {
            hex(i)[2:].upper().zfill(2): {"label": "NULL", "value": "0"} for i in range(256)
        }

    def submit_code(self, code_lines):
        self.instructions = code_lines
        return True

    def step(self):
        if self.ins_counter >= len(self.instructions):
            raise Exception("Program completed")

        instruction = self.instructions[self.ins_counter].strip()
        print(f"Executing instruction: {instruction}")

        # Execute instruction and update registers
        if instruction.startswith("JN"):
            address_str = instruction[3:5].strip()
            self._execute_jn(int(address_str))
        elif instruction.startswith("LDA"):
            label = instruction[4:].strip()
            self._execute_lda(label)
        elif instruction.startswith("STA"):
            label = instruction[4:].strip()
            self._execute_sta(label)
        elif instruction.startswith("ADD"):
            self._execute_add()
        elif instruction.startswith("SUB"):
            self._execute_sub()
        elif instruction.startswith("MBA"):
            self._execute_mba()
        elif instruction.startswith("JMP"):
            address_str = instruction[4:6].strip()
            self._execute_jmp(int(address_str))
        elif instruction.startswith("HLT"):
            self._execute_hlt()

        state = self.get_state()

        if not (
            instruction.startswith("JMP")
            or (instruction.startswith("JN") and self.nf_value == 1)
        ):
            self.ins_counter += 1

        print(f"ACC: {self.acc_value}, B: {self.b_value}, PC: {self.pc_counter}")
        return state

    def run_all(self):
        results = []
        while self.ins_counter < len(self.instructions):
            try:
                result = self.step()
                results.append(result)
            except Exception as e:
                break
        return results

    def get_state(self):
        return {
            "pc": str(self.pc_counter),
            "acc": str(self.acc_value),
            "b": str(self.b_value),
            "mar": str(self.pc_counter),
            "mdr": str(self.acc_value),
            "ir": str(self.ins_counter),
            "nf": str(self.nf_value),
            "comments": self._get_instruction_description(),
            "instruction": self._get_instruction_steps(),
            "ram": self.ram.copy(),
        }

    def set_ram_value(self, address, label, value):
        address = address.upper()
        if address in self.ram:
            self.ram[address] = {"label": label, "value": str(value)}
            print(f"Set RAM[{address}] = {{'label': '{label}', 'value': '{value}'}}")
            return True
        print(f"Failed to set RAM[{address}] - Address not found.")
        return False

    # Private instruction execution methods
    def _execute_mba(self):
        print(f"MBA: Moving ACC {self.acc_value} to B")
        self.b_value = self.acc_value
        self.pc_counter += 1

    def _execute_lda(self, label):
        print(f"LDA: Looking for label {label} in RAM")
        found = False
        for addr, data in self.ram.items():
            # Make the label comparison case-insensitive
            if data["label"].upper() == label.upper():
                try:
                    self.acc_value = int(data["value"])
                    found = True
                    print(f"LDA: Found value {self.acc_value} at label {label}")
                    break
                except ValueError:
                    print(f"LDA: Error converting value '{data['value']}' to integer")

        if not found:
            print(f"LDA: Label '{label}' not found in RAM")

        self.pc_counter += 1

    def _execute_sta(self, label):
        print(f"STA: Storing ACC value {self.acc_value} to label {label}")
        for addr, data in self.ram.items():
            if data["label"].upper() == label.upper():
                self.ram[addr]["value"] = str(self.acc_value)
                print(f"STA: Stored at address {addr}")
                break
        self.pc_counter += 1

    def _execute_add(self):
        self.acc_value += self.b_value
        self.pc_counter += 1

    def _execute_sub(self):
        result = self.acc_value - self.b_value
        if result < 0:
            self.nf_value = 1
            result *= -1
        else:
            self.nf_value = 0
        self.acc_value = result
        self.pc_counter += 1

    def _execute_jmp(self, address):
        self.ins_counter = self.pc_counter = address - 1

    def _execute_jn(self, address):
        if self.nf_value == 1:
            self.ins_counter = self.pc_counter = address - 1

    def _execute_hlt(self):
        self.pc_counter += 1

    def _get_instruction_description(self):
        current_ins = self.instructions[self.ins_counter]
        descriptions = {
            "MBA": "MBA\n(Move A to B)",
            "LDA": "LDA\n(Load A)",
            "STA": "STA\n(Store A)",
            "ADD": "ADD\n(Add B to A)",
            "SUB": "SUB\n(Subtract B from A)",
            "JMP": "JMP\n(Jump to Address)",
            "JN": "JN\n(Jump if Negative)",
            "HLT": "HLT\n(Terminate)",
        }
        for key in descriptions:
            if current_ins.startswith(key):
                return descriptions[key]
        return ""

    def _get_instruction_steps(self):
        current_ins = self.instructions[self.ins_counter]
        steps = {
            "MBA": "1. B <-- A",
            "LDA": "1. MAR <-- IR\n2.MDR <-- M(MAR)\n3. A <-- MDR",
            "STA": "1. MAR <-- IR\n2. MDR <-- A\n3. M(MAR) <-- MDR",
            "ADD": "1. A <-- ALU(add)",
            "SUB": "1. A <-- ALU(sub)",
            "JMP": "1. PC <-- IR",
            "JN": "1. PC <-- IR",
            "HLT": "",
        }
        for key in steps:
            if current_ins.startswith(key):
                return steps[key]
        return ""


if __name__ == "__main__":
    processor = ProcessorSimulator()
    processor.reset()
    processor.set_ram_value(
        "0A", "x", "10"
    )  # Storing value '10' with label 'x' at address '0A'
    code = [
        "LDA x",
        "ADD",
        "STA y",
        "HLT",
    ]
    processor.submit_code(code)
    processor.run_all()
