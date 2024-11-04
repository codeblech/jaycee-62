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