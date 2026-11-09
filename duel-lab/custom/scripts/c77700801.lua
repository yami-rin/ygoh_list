--呪われた剣
--Cursed Sword (original card)
--② "the monster equipped with this card gains ●" is applied by this card as an Equip Card (EFFECT_TYPE_EQUIP).
local s,id=GetID()
local SET_CURSED=0x7c7
function s.initial_effect(c)
	--① (Quick) target 1 face-up monster on the field: equip this card from the hand or Monster Zone to it
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_EQUIP)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetRange(LOCATION_HAND+LOCATION_MZONE)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.eqtg)
	e1:SetOperation(s.eqop)
	c:RegisterEffect(e1)
	--② ● the equipped monster gains 1000 ATK
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_EQUIP)
	e2:SetCode(EFFECT_UPDATE_ATTACK)
	e2:SetValue(1000)
	c:RegisterEffect(e2)
	--③ the equipped monster left the field and this card was destroyed: Special Summon this card from the GY
	local e3=Effect.CreateEffect(c)
	e3:SetDescription(aux.Stringid(id,1))
	e3:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e3:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e3:SetProperty(EFFECT_FLAG_DELAY)
	e3:SetCode(EVENT_TO_GRAVE)
	e3:SetCountLimit(1,{id,1})
	e3:SetCondition(s.spcon)
	e3:SetTarget(s.sptg)
	e3:SetOperation(s.spop)
	c:RegisterEffect(e3)
end
s.listed_series={SET_CURSED}
--equipping affects the monster: one unaffected by this effect cannot be chosen
function s.eqfilter(c,ec,e)
	return c:IsFaceup() and c~=ec and not c:IsImmuneToEffect(e)
end
function s.eqtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	local c=e:GetHandler()
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and s.eqfilter(chkc,c,e) end
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_SZONE)>0 and not c:IsForbidden()
		and Duel.IsExistingTarget(s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,c,c,e) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
	Duel.SelectTarget(tp,s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,c,c,e)
	Duel.SetOperationInfo(0,CATEGORY_EQUIP,c,1,0,0)
end
function s.eqop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	if not (c:IsRelateToEffect(e) and tc and tc:IsRelateToEffect(e) and tc:IsFaceup() and tc:IsLocation(LOCATION_MZONE) and not tc:IsImmuneToEffect(e)) then return end
	if Duel.GetLocationCount(tp,LOCATION_SZONE)<=0 then return end
	s.equip(c,c,tp,tc)
end
--equip ec to tc; it stays equipped only to tc
function s.equip(owner,ec,tp,tc,step)
	if not Duel.Equip(tp,ec,tc,true,step) then return false end
	local e1=Effect.CreateEffect(owner)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_EQUIP_LIMIT)
	e1:SetProperty(EFFECT_FLAG_CANNOT_DISABLE)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD)
	e1:SetLabelObject(tc)
	e1:SetValue(function(e,c) return c==e:GetLabelObject() end)
	ec:RegisterEffect(e1)
	return true
end
--destroyed while equipped because the equipped monster left the field (lost target, or left at the same time)
function s.spcon(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if not (c:IsReason(REASON_DESTROY) and c:IsPreviousLocation(LOCATION_SZONE)) then return false end
	if c:IsReason(REASON_LOST_TARGET) then return true end
	local ec=c:GetPreviousEquipTarget()
	return ec and not ec:IsLocation(LOCATION_MZONE)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and c:IsCanBeSpecialSummoned(e,0,tp,false,false) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,c,1,0,0)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	if c:IsRelateToEffect(e) then Duel.SpecialSummon(c,0,tp,tp,false,false,POS_FACEUP) end
end
