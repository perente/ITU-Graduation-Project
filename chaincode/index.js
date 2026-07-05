'use strict';

const { Contract } = require('fabric-contract-api');
const { ClientIdentity } = require('fabric-shim');

// Internship cycle status constants
const StatusCreated = "CREATED";
const StatusStudentApproved = "STUDENT_APPROVED";
const StatusCompanyApproved = "COMPANY_APPROVED";
const StatusFacultyApproved = "FACULTY_APPROVED";
const StatusActive = "ACTIVE";
const StatusCompleted = "COMPLETED";
const StatusRejected = "REJECTED";
const MinInternshipDurationDays = 20;
const WorkingDayCodes = Object.freeze(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
const WeeklyScheduleDayCodes = WorkingDayCodes;
const WeekdayToUtcDay = Object.freeze({
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
    SUN: 0
});

const CentralInternshipUnitID = "CENTRAL_UNIT";

const RejectionReasons = Object.freeze({
    MISSING_DOCUMENT: 'MISSING_DOCUMENT',
    INVALID_INFORMATION: 'INVALID_INFORMATION',
    STUDENT_WITHDREW: 'STUDENT_WITHDREW',
    OTHER: 'OTHER'
});

class InternshipContract extends Contract {

    getClient(ctx) {
        const cid = new ClientIdentity(ctx.stub);
        const mspId = cid.getMSPID();
        const id = cid.getID();
        const role = cid.getAttributeValue('role');
        const entityId = cid.getAttributeValue('id');
        return { mspId, id, role, entityId };
    }

    requireRole(client, allowedRoles) {
        if (!client.role || !allowedRoles.includes(client.role)) {
            throw new Error(`unauthorized: role ${client.role} not allowed`);
        }
    }

    requireEntityPresent(client) {
        if (!client.entityId) {
            throw new Error('unauthorized: missing entity id attribute in certificate');
        }
    }

    requireEntity(client, expectedId) {
        if (!client.entityId) {
            throw new Error('unauthorized: missing entity id attribute in certificate');
        }

        if (client.entityId !== expectedId) {
            throw new Error(`unauthorized: entity mismatch, expected ${expectedId}, got ${client.entityId}`);
        }
    }

    getTxTimestamp(ctx) {
        const ts = ctx.stub.getTxTimestamp();
        const seconds = typeof ts.seconds === 'object' && ts.seconds.low !== undefined
            ? ts.seconds.low
            : Number(ts.seconds);
        const millis = seconds * 1000 + Math.floor(ts.nanos / 1000000);
        return new Date(millis).toISOString();
    }

    toIsoDay(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return null;
        }

        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        if (isNaN(date.getTime())) {
            return null;
        }

        const isoDay = date.toISOString().slice(0, 10);
        return isoDay === value ? isoDay : null;
    }

    getTodayIsoDay(ctx) {
        return this.getTxTimestamp(ctx).slice(0, 10);
    }

    addDaysToIsoDay(isoDay, days) {
        const [year, month, day] = isoDay.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    }

    createUtcDateFromIsoDay(isoDay) {
        const [year, month, day] = isoDay.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    }

    validateDateRange(ctx, startDate, endDate) {
        const startDay = this.toIsoDay(startDate);
        const endDay = this.toIsoDay(endDate);

        if (!startDay || !endDay) {
            throw new Error('invalid date format');
        }

        if (startDay < this.getTodayIsoDay(ctx)) {
            throw new Error('startDate cannot be earlier than today');
        }

        if (startDay > endDay) {
            throw new Error('startDate cannot be later than endDate');
        }

        const minimumEndDay = this.addDaysToIsoDay(startDay, MinInternshipDurationDays);

        if (endDay < minimumEndDay) {
            throw new Error(`endDate must be at least ${MinInternshipDurationDays} days after startDate`);
        }
    }

    datesOverlap(start1, end1, start2, end2) {
        const s1 = new Date(start1);
        const e1 = new Date(end1);
        const s2 = new Date(start2);
        const e2 = new Date(end2);

        return s1 <= e2 && e1 >= s2;
    }

    normalizeInternshipType(internshipType) {
        return String(internshipType || '').trim().toUpperCase();
    }

    normalizeInternshipField(internshipField) {
        return String(internshipField || '').trim().toUpperCase();
    }

    parseTotalWorkingDays(totalWorkingDays) {
        const parsedValue = Number(totalWorkingDays);

        if (!Number.isInteger(parsedValue) || parsedValue < 0) {
            throw new Error('invalid totalWorkingDays');
        }

        return parsedValue;
    }

    parseWorkingDays(workingDays) {
        let parsedWorkingDays = workingDays;

        if (typeof parsedWorkingDays === 'string') {
            try {
                parsedWorkingDays = JSON.parse(parsedWorkingDays);
            } catch (error) {
                throw new Error('invalid workingDays format');
            }
        }

        if (!Array.isArray(parsedWorkingDays)) {
            throw new Error('invalid workingDays format');
        }

        const normalizedWorkingDays = parsedWorkingDays.map((dayCode) =>
            String(dayCode || '').trim().toUpperCase()
        );

        if (
            normalizedWorkingDays.length < 3 ||
            normalizedWorkingDays.length > 6
        ) {
            throw new Error('workingDays must contain between 3 and 6 unique days');
        }

        const uniqueWorkingDays = new Set();

        for (const dayCode of normalizedWorkingDays) {
            if (!WorkingDayCodes.includes(dayCode)) {
                throw new Error('workingDays must only include MON, TUE, WED, THU, FRI, SAT, SUN');
            }

            if (uniqueWorkingDays.has(dayCode)) {
                throw new Error('workingDays cannot contain duplicates');
            }

            uniqueWorkingDays.add(dayCode);
        }

        return normalizedWorkingDays;
    }

    parseWeeklySchedule(weeklySchedule) {
        if (!weeklySchedule) {
            return null;
        }

        let parsedWeeklySchedule = weeklySchedule;

        if (typeof parsedWeeklySchedule === 'string') {
            try {
                parsedWeeklySchedule = JSON.parse(parsedWeeklySchedule);
            } catch (error) {
                throw new Error('invalid weeklySchedule format');
            }
        }

        if (!Array.isArray(parsedWeeklySchedule) || parsedWeeklySchedule.length === 0) {
            throw new Error('weeklySchedule must contain at least one week');
        }

        return parsedWeeklySchedule.map((week) => {
            if (!Array.isArray(week)) {
                throw new Error('invalid weeklySchedule format');
            }

            const normalizedWeek = week.map((dayCode) =>
                String(dayCode || '').trim().toUpperCase()
            );

            if (normalizedWeek.length < 3 || normalizedWeek.length > 6) {
                throw new Error('each weeklySchedule week must contain between 3 and 6 unique days');
            }

            const uniqueWorkingDays = new Set();

            for (const dayCode of normalizedWeek) {
                if (!WeeklyScheduleDayCodes.includes(dayCode)) {
                    throw new Error('weeklySchedule must only include MON, TUE, WED, THU, FRI, SAT, SUN');
                }

                if (uniqueWorkingDays.has(dayCode)) {
                    throw new Error('weeklySchedule weeks cannot contain duplicate days');
                }

                uniqueWorkingDays.add(dayCode);
            }

            return normalizedWeek;
        });
    }

    calculateTotalWorkingDays(startDate, endDate, workingDays) {
        const startDay = this.toIsoDay(startDate);
        const endDay = this.toIsoDay(endDate);

        if (!startDay || !endDay) {
            throw new Error('invalid date format');
        }

        const selectedUtcDays = new Set(
            workingDays.map((dayCode) => WeekdayToUtcDay[dayCode])
        );
        let totalWorkingDays = 0;
        const currentDate = this.createUtcDateFromIsoDay(startDay);
        const finalDate = this.createUtcDateFromIsoDay(endDay);

        while (currentDate <= finalDate) {
            if (selectedUtcDays.has(currentDate.getUTCDay())) {
                totalWorkingDays += 1;
            }

            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        return totalWorkingDays;
    }

    calculateTotalScheduledWorkingDays(weeklySchedule) {
        return weeklySchedule.reduce((total, week) => total + week.length, 0);
    }

    getAgreementInternshipType(agreement) {
        return this.normalizeInternshipType(agreement.internshipType);
    }

    getAgreementInternshipField(agreement) {
        return this.normalizeInternshipField(agreement.internshipField);
    }

    getAgreementTotalWorkingDays(agreement) {
        // TODO: Backfill pre-change agreements without on-chain metadata so
        // voluntary totals do not undercount historical completions.
        const parsedValue = Number(agreement.totalWorkingDays);
        return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
    }

    async getStudentAgreements(ctx, studentId) {
        return this.collectAgreementsFromCompositeKey(
            ctx,
            'student~agreement',
            [studentId]
        );
    }

    async validateCreateAgreementBusinessRules(
        ctx,
        studentId,
        startDate,
        endDate,
        internshipType,
        internshipField,
        totalWorkingDays
    ) {
        const studentAgreements = await this.getStudentAgreements(ctx, studentId);

        for (const existingAgreement of studentAgreements) {
            if (existingAgreement.status === StatusRejected) {
                continue;
            }

            if (
                this.datesOverlap(
                    startDate,
                    endDate,
                    existingAgreement.startDate,
                    existingAgreement.endDate
                )
            ) {
                throw new Error('Student already has an overlapping internship.');
            }
        }

        // TODO: Backfill pre-change agreements without internship metadata so
        // mandatory progress checks do not undercount historical completions.
        const completedAgreements = studentAgreements.filter(
            (agreement) => agreement.status === StatusCompleted
        );

        if (internshipType === 'MANDATORY') {
            const completedMandatoryAgreements = completedAgreements.filter(
                (agreement) => this.getAgreementInternshipType(agreement) === 'MANDATORY'
            );

            if (completedMandatoryAgreements.length >= 2) {
                throw new Error('Student has already completed maximum mandatory internships.');
            }

            const hasMatchingField = completedMandatoryAgreements.some(
                (agreement) => this.getAgreementInternshipField(agreement) === internshipField
            );

            if (hasMatchingField) {
                throw new Error('Student cannot repeat a mandatory internship in the same field.');
            }
        }

        if (internshipType === 'VOLUNTARY') {
            const completedVoluntaryDays = completedAgreements
                .filter((agreement) => this.getAgreementInternshipType(agreement) === 'VOLUNTARY')
                .reduce(
                    (sum, agreement) => sum + this.getAgreementTotalWorkingDays(agreement),
                    0
                );

            if (completedVoluntaryDays + totalWorkingDays > 50) {
                throw new Error('Student cannot exceed 50 total voluntary internship days.');
            }
        }
    }

    isValidRejectionReason(reason) {
        return Object.values(RejectionReasons).includes(reason);
    }

    applyRejection(ctx, agreement, client, reason) {
        if (!this.isValidRejectionReason(reason)) {
            throw new Error(`invalid rejection reason: ${reason}`);
        }

        const ts = this.getTxTimestamp(ctx);
        agreement.status = StatusRejected;
        agreement.rejectedAt = ts;
        agreement.rejectedByRole = client.role;
        agreement.rejectionReason = reason;
        agreement.updatedAt = ts;
    }

    canCentralAccessAgreement(agreement) {
        return [StatusFacultyApproved, StatusActive, StatusCompleted].includes(agreement.status);
    }

    async AgreementExists(ctx, agreementId) {
        const data = await ctx.stub.getState(agreementId);
        return data && data.length > 0;
    }

    async getAgreementOrThrow(ctx, agreementId) {
        const data = await ctx.stub.getState(agreementId);

        if (!data || data.length === 0) {
            throw new Error(`agreement ${agreementId} does not exist`);
        }

        return JSON.parse(data.toString());
    }

    async ReadAgreement(ctx, agreementId) {
        const client = this.getClient(ctx);
        const agreement = await this.getAgreementOrThrow(ctx, agreementId);

        if (!client.role) {
            throw new Error('unauthorized: missing role');
        }

        if (client.role === 'student') {
            this.requireEntity(client, agreement.studentId);
        } else if (client.role === 'company') {
            this.requireEntity(client, agreement.companyId);
        } else if (client.role === 'faculty') {
            this.requireEntity(client, agreement.facultyId);
        } else if (client.role === 'central') {
            this.requireEntity(client, CentralInternshipUnitID);
            if (!this.canCentralAccessAgreement(agreement)) {
                throw new Error(`unauthorized: central cannot read agreement in status ${agreement.status}`);
            }
        } else if (client.role !== 'admin') {
            throw new Error('unauthorized to read this agreement');
        }

        return JSON.stringify(agreement);
    }

    async writeAgreement(ctx, agreement) {
        agreement.updatedAt = this.getTxTimestamp(ctx);
        await ctx.stub.putState(
            agreement.agreementId,
            Buffer.from(JSON.stringify(agreement))
        );
    }

    async putIndex(ctx, agreement) {
        const studentKey = ctx.stub.createCompositeKey('student~agreement', [agreement.studentId, agreement.agreementId]);
        const companyKey = ctx.stub.createCompositeKey('company~agreement', [agreement.companyId, agreement.agreementId]);
        const facultyKey = ctx.stub.createCompositeKey('faculty~agreement', [agreement.facultyId, agreement.agreementId]);

        await ctx.stub.putState(studentKey, Buffer.from('\u0000'));
        await ctx.stub.putState(companyKey, Buffer.from('\u0000'));
        await ctx.stub.putState(facultyKey, Buffer.from('\u0000'));
    }

    async collectAgreementsFromCompositeKey(ctx, indexName, attributes) {
        const iter = await ctx.stub.getStateByPartialCompositeKey(indexName, attributes);
        const agreements = [];

        try {
            while (true) {
                const res = await iter.next();

                if (res.value && res.value.key) {
                    const { attributes: keyParts } = ctx.stub.splitCompositeKey(res.value.key);
                    const agreementId = keyParts[1];

                    const agreement = await this.getAgreementOrThrow(ctx, agreementId);
                    agreements.push(agreement);
                }

                if (res.done) {
                    break;
                }
            }
        } finally {
            await iter.close();
        }

        return agreements;
    }

    async collectAllAgreements(ctx) {
        const iter = await ctx.stub.getStateByRange('', '');
        const agreements = [];

        try {
            while (true) {
                const res = await iter.next();

                if (res.value && res.value.value) {
                    const rawValue = res.value.value.toString('utf8');

                    try {
                        const record = JSON.parse(rawValue);

                        if (record && record.agreementId) {
                            agreements.push(record);
                        }
                    } catch (e) {
                        // composite index entries are not agreement JSON
                    }
                }

                if (res.done) {
                    break;
                }
            }
        } finally {
            await iter.close();
        }

        return agreements;
    }

    filterAgreementsByStatus(agreements, allowedStatuses) {
        return agreements.filter(agreement => allowedStatuses.includes(agreement.status));
    }

    emitAgreementEvent(ctx, eventName, agreement) {
        const payload = {
            eventType: eventName,
            agreementId: agreement.agreementId,
            studentId: agreement.studentId,
            companyId: agreement.companyId,
            facultyId: agreement.facultyId,
            status: agreement.status,
            updatedAt: agreement.updatedAt
        };

        if (agreement.rejectedAt) {
            payload.rejectedAt = agreement.rejectedAt;
            payload.rejectedByRole = agreement.rejectedByRole;
            payload.rejectionReason = agreement.rejectionReason;
        }

        if (agreement.completedAt) {
            payload.completedAt = agreement.completedAt;
        }

        ctx.stub.setEvent(eventName, Buffer.from(JSON.stringify(payload)));
    }

    async GetAgreementHistory(ctx, agreementId) {
        const client = this.getClient(ctx);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);

        if (client.role === 'student') {
            this.requireEntity(client, agreement.studentId);
        } else if (client.role === 'company') {
            this.requireEntity(client, agreement.companyId);
        } else if (client.role === 'faculty') {
            this.requireEntity(client, agreement.facultyId);
        } else if (client.role === 'central') {
            this.requireEntity(client, CentralInternshipUnitID);
            if (!this.canCentralAccessAgreement(agreement)) {
                throw new Error(`unauthorized: central cannot read agreement history in status ${agreement.status}`);
            }
        } else if (client.role !== 'admin') {
            throw new Error('unauthorized to read agreement history');
        }

        const iter = await ctx.stub.getHistoryForKey(agreementId);
        const history = [];

        try {
            while (true) {
                const res = await iter.next();

                if (res.value) {
                    const txTimestamp = res.value.timestamp;
                    const seconds =
                        typeof txTimestamp.seconds === 'object' && txTimestamp.seconds.low !== undefined
                            ? txTimestamp.seconds.low
                            : Number(txTimestamp.seconds);

                    const millis = seconds * 1000 + Math.floor(txTimestamp.nanos / 1000000);

                    let parsedValue = null;
                    const rawValue = res.value.value.toString('utf8');

                    if (rawValue && rawValue.length > 0) {
                        try {
                            parsedValue = JSON.parse(rawValue);
                        } catch (e) {
                            parsedValue = rawValue;
                        }
                    }

                    history.push({
                        txId: res.value.txId,
                        timestamp: new Date(millis).toISOString(),
                        isDelete: res.value.isDelete,
                        value: parsedValue
                    });
                }

                if (res.done) {
                    break;
                }
            }
        } finally {
            await iter.close();
        }

        return JSON.stringify(history);
    }

    // =========================
    // SELF-SERVICE LISTING
    // =========================

    async GetMyStudentAgreements(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['student']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'student~agreement',
            [client.entityId]
        );

        return JSON.stringify(agreements);
    }

    async GetMyCompanyAgreements(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['company']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'company~agreement',
            [client.entityId]
        );

        return JSON.stringify(agreements);
    }

    async GetMyFacultyAgreements(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['faculty']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'faculty~agreement',
            [client.entityId]
        );

        return JSON.stringify(agreements);
    }

    // =========================
    // ADMIN LISTING
    // =========================

    async AdminGetAgreementsByStudent(ctx, studentId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['admin']);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'student~agreement',
            [studentId]
        );

        return JSON.stringify(agreements);
    }

    async AdminGetAgreementsByCompany(ctx, companyId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['admin']);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'company~agreement',
            [companyId]
        );

        return JSON.stringify(agreements);
    }

    async AdminGetAgreementsByFaculty(ctx, facultyId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['admin']);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'faculty~agreement',
            [facultyId]
        );

        return JSON.stringify(agreements);
    }

    // =========================
    // PENDING LISTS
    // =========================

    async GetPendingAgreementsForStudent(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['student']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'student~agreement',
            [client.entityId]
        );

        const pending = this.filterAgreementsByStatus(agreements, [StatusCreated]);

        return JSON.stringify(pending);
    }

    async GetPendingAgreementsForCompany(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['company']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'company~agreement',
            [client.entityId]
        );

        const pending = this.filterAgreementsByStatus(agreements, [StatusStudentApproved]);

        return JSON.stringify(pending);
    }

    async GetPendingAgreementsForFaculty(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['faculty']);
        this.requireEntityPresent(client);

        const agreements = await this.collectAgreementsFromCompositeKey(
            ctx,
            'faculty~agreement',
            [client.entityId]
        );

        const pending = this.filterAgreementsByStatus(agreements, [StatusCompanyApproved]);

        return JSON.stringify(pending);
    }

    async GetPendingAgreementsForCentral(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['central', 'admin']);

        if (client.role === 'central') {
            this.requireEntity(client, CentralInternshipUnitID);
        }

        const agreements = await this.collectAllAgreements(ctx);
        const pending = this.filterAgreementsByStatus(agreements, [StatusFacultyApproved]);

        return JSON.stringify(pending);
    }

    async GetActiveAgreementsForCentral(ctx) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['central', 'admin']);

        if (client.role === 'central') {
            this.requireEntity(client, CentralInternshipUnitID);
        }

        const agreements = await this.collectAllAgreements(ctx);
        const active = this.filterAgreementsByStatus(agreements, [StatusActive]);

        return JSON.stringify(active);
    }    

    async CreateAgreement(
        ctx,
        agreementId,
        studentId,
        companyId,
        facultyId,
        startDate,
        endDate,
        internshipType,
        internshipField,
        workingDays,
        weeklySchedule,
        totalWorkingDays
    ) {
        if (totalWorkingDays === undefined) {
            totalWorkingDays = weeklySchedule;
            weeklySchedule = '';
        }

        const client = this.getClient(ctx);
        this.requireRole(client, ['student']);
        this.requireEntity(client, studentId);

        this.validateDateRange(ctx, startDate, endDate);

        const normalizedInternshipType = this.normalizeInternshipType(internshipType);
        const normalizedInternshipField = this.normalizeInternshipField(internshipField);
        const normalizedWeeklySchedule = this.parseWeeklySchedule(weeklySchedule);
        const normalizedWorkingDays = normalizedWeeklySchedule
            ? []
            : this.parseWorkingDays(workingDays);
        const providedTotalWorkingDays = this.parseTotalWorkingDays(totalWorkingDays);
        const computedTotalWorkingDays = normalizedWeeklySchedule
            ? this.calculateTotalScheduledWorkingDays(normalizedWeeklySchedule)
            : this.calculateTotalWorkingDays(
                startDate,
                endDate,
                normalizedWorkingDays
            );

        if (!['MANDATORY', 'VOLUNTARY'].includes(normalizedInternshipType)) {
            throw new Error('invalid internshipType');
        }

        if (!normalizedInternshipField) {
            throw new Error('invalid internshipField');
        }

        if (providedTotalWorkingDays !== computedTotalWorkingDays) {
            throw new Error('provided totalWorkingDays does not match schedule');
        }

        const exists = await this.AgreementExists(ctx, agreementId);
        if (exists) {
            throw new Error(`agreement ${agreementId} already exists`);
        }

        await this.validateCreateAgreementBusinessRules(
            ctx,
            studentId,
            startDate,
            endDate,
            normalizedInternshipType,
            normalizedInternshipField,
            computedTotalWorkingDays
        );

        const ts = this.getTxTimestamp(ctx);

        const agreement = {
            agreementId,
            studentId,
            companyId,
            facultyId,
            startDate,
            endDate,
            internshipType: normalizedInternshipType,
            internshipField: normalizedInternshipField,
            workingDays: normalizedWorkingDays,
            weeklySchedule: normalizedWeeklySchedule,
            weeklyWorkingDayCount: normalizedWeeklySchedule
                ? Math.max(...normalizedWeeklySchedule.map((week) => week.length))
                : normalizedWorkingDays.length,
            totalWorkingDays: computedTotalWorkingDays,
            status: StatusCreated,
            createdAt: ts,
            updatedAt: ts,
            rejectedAt: null,
            rejectedByRole: null,
            rejectionReason: null,
            completedAt: null
        };

        await ctx.stub.putState(
            agreementId,
            Buffer.from(JSON.stringify(agreement))
        );

        await this.putIndex(ctx, agreement);

        this.emitAgreementEvent(ctx, 'AgreementCreated', agreement);

        return JSON.stringify({
            message: 'Agreement created successfully',
            agreementId: agreement.agreementId,
            status: agreement.status
        });
    }

    async ApproveByStudent(ctx, agreementId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['student']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.studentId);

        if (agreement.status !== StatusCreated) {
            throw new Error(`invalid state: expected ${StatusCreated}`);
        }

        agreement.status = StatusStudentApproved;
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementApprovedByStudent', agreement);

        return JSON.stringify({
            message: 'Student approved successfully',
            agreementId: agreement.agreementId,
            status: agreement.status
        });
    }

    async ApproveByCompany(ctx, agreementId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['company']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.companyId);

        if (agreement.status !== StatusStudentApproved) {
            throw new Error(`invalid state: expected ${StatusStudentApproved}`);
        }

        agreement.status = StatusCompanyApproved;
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementApprovedByCompany', agreement);

        return JSON.stringify({
            message: 'Company approved successfully',
            agreementId: agreement.agreementId,
            status: agreement.status
        });
    }

    async ApproveByFaculty(ctx, agreementId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['faculty']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.facultyId);

        if (agreement.status !== StatusCompanyApproved) {
            throw new Error(`invalid state: expected ${StatusCompanyApproved}`);
        }

        agreement.status = StatusFacultyApproved;
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementApprovedByFaculty', agreement);

        return JSON.stringify({
            message: 'Faculty approved successfully',
            agreementId: agreement.agreementId,
            status: agreement.status
        });
    }

    async RejectByStudent(ctx, agreementId, reason) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['student']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.studentId);

        const allowedStatuses = [
            StatusCreated,
            StatusStudentApproved,
            StatusCompanyApproved
        ];

        if (!allowedStatuses.includes(agreement.status)) {
            throw new Error(`student cannot reject agreement in status ${agreement.status}`);
        }

        this.applyRejection(ctx, agreement, client, reason);
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementRejectedByStudent', agreement);

        return JSON.stringify({
            message: 'Agreement rejected by student',
            agreementId: agreement.agreementId,
            status: agreement.status,
            rejectedByRole: agreement.rejectedByRole,
            rejectionReason: agreement.rejectionReason,
            rejectedAt: agreement.rejectedAt
        });
    }

    async RejectByCompany(ctx, agreementId, reason) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['company']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.companyId);

        if (agreement.status !== StatusStudentApproved) {
            throw new Error(`invalid state: expected ${StatusStudentApproved}`);
        }

        this.applyRejection(ctx, agreement, client, reason);
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementRejectedByCompany', agreement);

        return JSON.stringify({
            message: 'Agreement rejected by company',
            agreementId: agreement.agreementId,
            status: agreement.status,
            rejectedByRole: agreement.rejectedByRole,
            rejectionReason: agreement.rejectionReason,
            rejectedAt: agreement.rejectedAt
        });
    }

    async RejectByFaculty(ctx, agreementId, reason) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['faculty']);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);
        this.requireEntity(client, agreement.facultyId);

        if (agreement.status !== StatusCompanyApproved) {
            throw new Error(`invalid state: expected ${StatusCompanyApproved}`);
        }

        this.applyRejection(ctx, agreement, client, reason);
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementRejectedByFaculty', agreement);

        return JSON.stringify({
            message: 'Agreement rejected by faculty',
            agreementId: agreement.agreementId,
            status: agreement.status,
            rejectedByRole: agreement.rejectedByRole,
            rejectionReason: agreement.rejectionReason,
            rejectedAt: agreement.rejectedAt
        });
    }

    async ActivateAgreement(ctx, agreementId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['central']);
        this.requireEntity(client, CentralInternshipUnitID);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);

        if (agreement.status !== StatusFacultyApproved) {
            throw new Error(`invalid state: expected ${StatusFacultyApproved}`);
        }

        agreement.status = StatusActive;
        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementActivated', agreement);

        return JSON.stringify({
            message: 'Agreement activated',
            agreementId: agreement.agreementId,
            status: agreement.status
        });
    }

    async CompleteAgreement(ctx, agreementId) {
        const client = this.getClient(ctx);
        this.requireRole(client, ['central']);
        this.requireEntity(client, CentralInternshipUnitID);

        const agreement = await this.getAgreementOrThrow(ctx, agreementId);

        if (agreement.status !== StatusActive) {
            throw new Error(`invalid state: expected ${StatusActive}`);
        }

        agreement.status = StatusCompleted;
        agreement.completedAt = this.getTxTimestamp(ctx);

        await this.writeAgreement(ctx, agreement);
        this.emitAgreementEvent(ctx, 'AgreementCompleted', agreement);

        return JSON.stringify({
            message: 'Agreement completed',
            agreementId: agreement.agreementId,
            status: agreement.status,
            completedAt: agreement.completedAt
        });
    }
}

module.exports = InternshipContract;
