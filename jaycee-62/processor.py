# processor.py
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
            hex(i)[2:].upper(): {"label": "NULL", "value": "NULL"} for i in range(256)
        }

    def submit_code(self, code_lines):
        self.instructions = code_lines
        return True

    def step(self):
        if self.ins_counter >= len(self.instructions):
            raise Exception("Program completed")

        instruction = self.instructions[self.ins_counter].strip()

        # Execute instruction and update registers
        if instruction.startswith("JN"):
            self._execute_jn(int(instruction[3:5]))
        elif instruction.startswith("LDA"):
            self._execute_lda(instruction[4:])
        elif instruction.startswith("STA"):
            self._execute_sta(instruction[4:])
        elif instruction.startswith("ADD"):
            self._execute_add()
        elif instruction.startswith("SUB"):
            self._execute_sub()
        elif instruction.startswith("MBA"):
            self._execute_mba()
        elif instruction.startswith("JMP"):
            self._execute_jmp(int(instruction[4:6]))
        elif instruction.startswith("HLT"):
            self._execute_hlt()

        state = self.get_state()
        self.ins_counter += 1
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
            "pc": self.pc_counter,
            "acc": self.acc_value,
            "b": self.b_value,
            "mar": self.pc_counter,
            "mdr": self.acc_value,
            "ir": self.ins_counter,
            "nf": self.nf_value,
            "comments": self._get_instruction_description(),
            "instruction": self._get_instruction_steps(),
            "ram": self.ram,
        }

    def set_ram_value(self, address, label, value):
        if address in self.ram:
            self.ram[address] = {"label": label, "value": value}
            return True
        return False

    # Private instruction execution methods
    def _execute_mba(self):
        self.b_value = self.acc_value
        self.pc_counter += 1

    def _execute_lda(self, label):
        for addr, data in self.ram.items():
            if data["label"] == label:
                self.acc_value = int(data["value"])
                break
        self.pc_counter += 1

    def _execute_sta(self, label):
        for addr, data in self.ram.items():
            if data["label"] == label:
                self.ram[addr]["value"] = str(self.acc_value)
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
