--希望の聖剣
--Holy Sword of Hope (original card)
--② "the monster equipped with this card gains ●" is applied by this card as an Equip Card. "That player's opponent"
--is the opponent of the equipped monster's controller.
local s,id=GetID()
function s.initial_effect(c)
	--① (Quick) target 1 face-up monster on the field: equip this card from the hand or Monster Zone to it, treated as
	--   an Equip Spell (no once-per-turn limit; from the Spell & Trap Zone it cannot be activated again)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_EQUIP)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetRange(LOCATION_HAND+LOCATION_MZONE)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e1:SetTarget(s.eqtg)
	e1:SetOperation(s.eqop)
	c:RegisterEffect(e1)
	--② ● while the equipped monster battles, until the end of the Damage Step: the opponent cannot activate effects,
	--  and the effects of face-up cards the opponent controls are negated
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_FIELD)
	e2:SetCode(EFFECT_CANNOT_ACTIVATE)
	e2:SetProperty(EFFECT_FLAG_PLAYER_TARGET)
	e2:SetRange(LOCATION_SZONE)
	e2:SetTargetRange(1,1)
	e2:SetCondition(s.batcon)
	e2:SetValue(s.actlimit)
	c:RegisterEffect(e2)
	local e3=Effect.CreateEffect(c)
	e3:SetType(EFFECT_TYPE_FIELD)
	e3:SetCode(EFFECT_DISABLE)
	e3:SetRange(LOCATION_SZONE)
	e3:SetTargetRange(LOCATION_ONFIELD,LOCATION_ONFIELD)
	e3:SetCondition(s.batcon)
	e3:SetTarget(s.distg)
	c:RegisterEffect(e3)
end
function s.eqfilter(c,ec)
	return c:IsFaceup() and c~=ec
end
function s.eqtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	local c=e:GetHandler()
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and s.eqfilter(chkc,c) end
	if chk==0 then return Duel.GetLocationCount(tp,LOCATION_SZONE)>0 and not c:IsForbidden()
		and Duel.IsExistingTarget(s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,c,c) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_EQUIP)
	Duel.SelectTarget(tp,s.eqfilter,tp,LOCATION_MZONE,LOCATION_MZONE,1,1,c,c)
	Duel.SetOperationInfo(0,CATEGORY_EQUIP,c,1,0,0)
end
function s.eqop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	if not (c:IsRelateToEffect(e) and tc and tc:IsRelateToEffect(e) and tc:IsFaceup() and tc:IsLocation(LOCATION_MZONE)) then return end
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
--the equipped monster is the attacker or the attack target (from the attack declaration to the end of the Damage Step)
function s.batcon(e)
	local ec=e:GetHandler():GetEquipTarget()
	return ec~=nil and (Duel.GetAttacker()==ec or Duel.GetAttackTarget()==ec)
end
--(the value / target can be evaluated outside the condition: check the equip target again)
function s.actlimit(e,re,rp)
	local ec=e:GetHandler():GetEquipTarget()
	return ec~=nil and rp==1-ec:GetControler()
end
function s.distg(e,tc)
	local ec=e:GetHandler():GetEquipTarget()
	return ec~=nil and tc:IsFaceup() and tc:IsControler(1-ec:GetControler())
end
