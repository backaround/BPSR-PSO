import { StatisticData } from './StatisticData.js';
import skill_names from '../tables/skill_names.json' with { type: 'json' };
import skill_names_english from '../tables/skill_names_english.json' with { type: 'json' };
import skill_images from '../tables/skill_images.json' with { type: 'json' };
import chinese_to_english from '../tables/chinese_to_english.json' with { type: 'json' };

function getSkillNameEnglish(skillId) {
    const chineseName = skill_names[skillId];
    if (!chineseName) {
        return `Unknown Skill (${skillId})`;
    }
    const englishName = skill_names_english[chineseName];
    return englishName || chineseName;
}

function getSkillImage(skillNameEnglish) {
    return skill_images[skillNameEnglish] || null;
}

function getSkillType(SkillType) {
    return chinese_to_english[SkillType] || null;
}

function getSubProfessionBySkillId(skillId) {
    switch (skillId) {
        case 1241:
            return '(Frostbeam)';
        case 2307:
        case 2361:
        case 55302:
            return '(Concerto)';
        case 20301:
            return '(Lifebind)';
        case 1518:
        case 1541:
        case 21402:
            return '(Smite)';
        case 2306:
            return '(Dissonance)';
        case 120901:
        case 120902:
            return '(Icicle)';
        case 1714:
        case 1734:
            return '(Iaido Slash)';
        case 44701:
        case 179906:
            return '(Moonstrike)';
        case 220112:
        case 2203622:
            return '(Falconry)';
        case 2292:
        case 1700820:
        case 1700825:
        case 1700827:
            return '(Wildpack)';
        case 1419:
            return '(Vanguard)';
        case 1405:
        case 1418:
            return '(Skyward)';
        case 2405:
            return '(Shield)';
        case 2406:
            return '(Recovery)';
        case 199902:
            return '(Earthfort)';
        case 1930:
        case 1931:
        case 1934:
        case 1935:
            return '(Block)';
        default:
            return '';
    }
}

export class UserData {
    constructor(uid) {
        this.uid = uid;
        this.name = '';
        this.damageStats = new StatisticData(this, '伤害');
        this.healingStats = new StatisticData(this, '治疗');
        this.takenDamage = 0; // 承伤
        this.deadCount = 0; // 死亡次数
        this.profession = '...';
        this.skillUsage = new Map(); // 技能使用情况
        this.fightPoint = 0; // 总评分
        this.subProfession = '';
        this.attr = {};
        this.lastUpdateTime = Date.now();
        this.isCurrentUserUuid = false;
    }

    _touch() {
        this.lastUpdateTime = Date.now();
    }

    /** 添加伤害记录
     * @param {number} skillId - 技能ID/Buff ID
     * @param {string} element - 技能元素属性
     * @param {number} damage - 伤害值
     * @param {boolean} isCrit - 是否为暴击
     * @param {boolean} [isLucky] - 是否为幸运
     * @param {boolean} [isCauseLucky] - 是否造成幸运
     * @param {number} hpLessenValue - 生命值减少量
     */
    addDamage(skillId, element, damage, isCrit, isLucky, isCauseLucky, hpLessenValue = 0) {
        this._touch();
        this.damageStats.addRecord(damage, isCrit, isLucky, hpLessenValue);
        // 记录技能使用情况
        if (!this.skillUsage.has(skillId)) {
            this.skillUsage.set(skillId, new StatisticData(this, '伤害', element));
        }
        this.skillUsage.get(skillId).addRecord(damage, isCrit, isCauseLucky, hpLessenValue);
        this.skillUsage.get(skillId).realtimeWindow.length = 0;

        const subProfession = getSubProfessionBySkillId(skillId);
        if (subProfession) {
            this.setSubProfession(subProfession);
        }
    }

    /** 添加治疗记录
     * @param {number} skillId - 技能ID/Buff ID
     * @param {string} element - 技能元素属性
     * @param {number} healing - 治疗值
     * @param {boolean} isCrit - 是否为暴击
     * @param {boolean} [isLucky] - 是否为幸运
     * @param {boolean} [isCauseLucky] - 是否造成幸运
     */
    addHealing(skillId, element, healing, isCrit, isLucky, isCauseLucky) {
        this._touch();
        this.healingStats.addRecord(healing, isCrit, isLucky);
        // 记录技能使用情况
        skillId = skillId + 1000000000;
        if (!this.skillUsage.has(skillId)) {
            this.skillUsage.set(skillId, new StatisticData(this, '治疗', element));
        }
        this.skillUsage.get(skillId).addRecord(healing, isCrit, isCauseLucky);
        this.skillUsage.get(skillId).realtimeWindow.length = 0;

        const subProfession = getSubProfessionBySkillId(skillId - 1000000000);
        if (subProfession) {
            this.setSubProfession(subProfession);
        }
    }

    /** 添加承伤记录
     * @param {number} damage - 承受的伤害值
     * @param {boolean} isDead - 是否致死伤害
     * */
    addTakenDamage(damage, isDead) {
        this._touch();
        this.takenDamage += damage;
        if (isDead) {
            this.deadCount++;
        }
    }

    /** 更新实时DPS和HPS 计算过去1秒内的总伤害和治疗 */
    updateRealtimeDps() {
        this.damageStats.updateRealtimeStats();
        this.healingStats.updateRealtimeStats();
    }

    /** 计算总DPS */
    getTotalDps() {
        return this.damageStats.getTotalPerSecond();
    }

    /** 计算总HPS */
    getTotalHps() {
        return this.healingStats.getTotalPerSecond();
    }

    /** 获取合并的次数统计 */
    getTotalCount() {
        return {
            normal: this.damageStats.count.normal + this.healingStats.count.normal,
            critical: this.damageStats.count.critical + this.healingStats.count.critical,
            lucky: this.damageStats.count.lucky + this.healingStats.count.lucky,
            total: this.damageStats.count.total + this.healingStats.count.total,
        };
    }

    /** 获取用户数据摘要 */
    getSummary() {
        return {
            realtime_dps: this.damageStats.realtimeStats.value,
            realtime_dps_max: this.damageStats.realtimeStats.max,
            total_dps: this.getTotalDps(),
            total_damage: { ...this.damageStats.stats },
            total_count: this.getTotalCount(),
            realtime_hps: this.healingStats.realtimeStats.value,
            realtime_hps_max: this.healingStats.realtimeStats.max,
            total_hps: this.getTotalHps(),
            total_healing: { ...this.healingStats.stats },
            taken_damage: this.takenDamage,
            profession: this.profession + (this.subProfession ? ` ${this.subProfession}` : ''),
            name: this.name,
            fightPoint: this.fightPoint,
            hp: this.attr.hp,
            max_hp: this.attr.max_hp,
            dead_count: this.deadCount,
            isCurrentUserUuid: this.isCurrentUserUuid,
        };
    }

    /** 获取技能统计数据 */
    getSkillSummary() {
        const skillsByName = {};

        // First pass: aggregate skills with the same name
        for (const [skillId, stat] of this.skillUsage) {
            const name = getSkillNameEnglish(skillId % 1000000000 ?? skillId % 1000000000);
            const image = getSkillImage(name);
            const elementype = stat.element;
            const type = getSkillType(stat.type);

            if (!skillsByName[name]) {
                // Initialize aggregated skill data
                skillsByName[name] = {
                    displayName: name,
                    type: type,
                    image: image,
                    elementype: elementype,
                    totalDamage: 0,
                    totalCount: 0,
                    critCount: 0,
                    luckyCount: 0,
                    damageBreakdown: {
                        normal: 0,
                        critical: 0,
                        lucky: 0,
                        crit_lucky: 0,
                        total: 0
                    },
                    countBreakdown: {
                        normal: 0,
                        critical: 0,
                        lucky: 0,
                        crit_lucky: 0,
                        total: 0
                    }
                };
            }

            // Aggregate the stats
            const skill = skillsByName[name];
            skill.totalDamage += stat.stats.total;
            skill.totalCount += stat.count.total;
            skill.critCount += stat.count.critical;
            skill.luckyCount += stat.count.lucky;

            // Aggregate damage breakdown
            skill.damageBreakdown.normal += stat.stats.normal;
            skill.damageBreakdown.critical += stat.stats.critical;
            skill.damageBreakdown.lucky += stat.stats.lucky;
            skill.damageBreakdown.crit_lucky += stat.stats.crit_lucky;
            skill.damageBreakdown.total += stat.stats.total;

            // Aggregate count breakdown
            skill.countBreakdown.normal += stat.count.normal;
            skill.countBreakdown.critical += stat.count.critical;
            skill.countBreakdown.lucky += stat.count.lucky;
            skill.countBreakdown.crit_lucky += stat.count.crit_lucky;
            skill.countBreakdown.total += stat.count.total;
        }

        // Second pass: calculate rates for aggregated skills
        const skills = {};
        let skillIndex = 0;
        for (const [name, skill] of Object.entries(skillsByName)) {
            const critRate = skill.totalCount > 0 ? skill.critCount / skill.totalCount : 0;
            const luckyRate = skill.totalCount > 0 ? skill.luckyCount / skill.totalCount : 0;

            skills[skillIndex++] = {
                ...skill,
                critRate: critRate,
                luckyRate: luckyRate
            };
        }

        return skills;
    }

    /** 设置玩家UUID
     * @param {string|null} uuid - 玩家UUID
     * */
    setIsCurrentUserUuid() {
        // this._touch();
        this.isCurrentUserUuid = true;
    }

    /** 设置职业
     * @param {string} profession - 职业名称
     * */
    setProfession(profession) {
        this._touch();
        if (profession !== this.profession) {
            this.setSubProfession('');
        }
        this.profession = profession;
    }

    /** 设置子职业
     * @param {string} subProfession - 子职业名称
     * */
    setSubProfession(subProfession) {
        this._touch();
        this.subProfession = subProfession;
    }

    /** 设置姓名
     * @param {string} name - 姓名
     * */
    setName(name) {
        this._touch();
        this.name = name;
    }

    /** 设置用户总评分
     * @param {number} fightPoint - 总评分
     * */
    setFightPoint(fightPoint) {
        this._touch();
        this.fightPoint = fightPoint;
    }

    /** 设置额外数据
     * @param {string} key
     * @param {any} value
     * */
    setAttrKV(key, value) {
        this._touch();
        this.attr[key] = value;
    }

    /** 重置数据 预留 */
    reset() {
        this.isCurrentUserUuid = false;
        this.damageStats.reset();
        this.healingStats.reset();
        this.takenDamage = 0;
        this.skillUsage.clear();
        this.fightPoint = 0;
        this._touch();
    }
}
