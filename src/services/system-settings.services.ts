import { Prisma } from '~/generated/prisma/client'
import { prisma } from '~/config/prisma'
import { UpdateSystemSettingDto } from '~/models/schemas/system-setting.schema'

const SETTING_ID = 'default'

class SystemSettingsServices {
  async get() {
    return prisma.systemSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID },
      update: {}
    })
  }

  async update(dto: UpdateSystemSettingDto) {
    const data: Prisma.SystemSettingUpdateInput = {
      ...dto,
      ...(dto.vatRate !== undefined && { vatRate: new Prisma.Decimal(dto.vatRate) }),
      ...(dto.serviceFeeRate !== undefined && { serviceFeeRate: new Prisma.Decimal(dto.serviceFeeRate) }),
      ...(dto.defaultDeliveryFee !== undefined && {
        defaultDeliveryFee: new Prisma.Decimal(dto.defaultDeliveryFee)
      })
    }
    return prisma.systemSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID, ...data as Prisma.SystemSettingCreateInput },
      update: data
    })
  }

  async getVatRate() {
    const setting = await this.get()
    return Number(setting.vatRate.toString()) / 100
  }
}

export default new SystemSettingsServices()
