--連鎖律の遡及
--Chain Code Revert (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	--● Set 1 "Chain Code" Spell/Trap from your GY/banishment (it can be activated this turn if this card was Chain Link 3+)
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetCountLimit(1,{id,0})
	e1:SetTarget(s.settg)
	e1:SetOperation(s.setop)
	c:RegisterEffect(e1)
	--● target 1 "Chain Code" monster you control: it is unaffected by your opponent's effects until end of turn
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetType(EFFECT_TYPE_ACTIVATE)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e2:SetCountLimit(1,{id,1})
	e2:SetTarget(s.imtg)
	e2:SetOperation(s.imop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
function s.setfilter(c)
	return c:IsSetCard(SET_CHAIN_CODE) and c:IsSpellTrap() and c:IsSSetable() and (c:IsLocation(LOCATION_GRAVE) or c:IsFaceup())
end
function s.settg(e,tp,eg,ep,ev,re,r,rp,chk)
	--this card itself is still on the field while activating, so it is never its own target
	if chk==0 then return Duel.IsExistingMatchingCard(s.setfilter,tp,LOCATION_GRAVE+LOCATION_REMOVED,0,1,nil) end
	e:SetLabel(Duel.GetCurrentChain())
end
function s.setop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SET)
	local tc=Duel.SelectMatchingCard(tp,aux.NecroValleyFilter(s.setfilter),tp,LOCATION_GRAVE+LOCATION_REMOVED,0,1,1,nil):GetFirst()
	if not tc or Duel.SSet(tp,tc)==0 or e:GetLabel()<3 then return end
	--activated as Chain Link 3 or higher: the Set card can be activated this turn
	local e1=Effect.CreateEffect(e:GetHandler())
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(tc:IsTrap() and EFFECT_TRAP_ACT_IN_SET_TURN or EFFECT_QP_ACT_IN_SET_TURN)
	e1:SetProperty(EFFECT_FLAG_SET_AVAILABLE)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD+RESET_PHASE+PHASE_END)
	tc:RegisterEffect(e1)
end
function s.imfilter(c)
	return c:IsFaceup() and c:IsSetCard(SET_CHAIN_CODE)
end
function s.imtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return chkc:IsLocation(LOCATION_MZONE) and chkc:IsControler(tp) and s.imfilter(chkc) end
	if chk==0 then return Duel.IsExistingTarget(s.imfilter,tp,LOCATION_MZONE,0,1,nil) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TARGET)
	Duel.SelectTarget(tp,s.imfilter,tp,LOCATION_MZONE,0,1,1,nil)
end
function s.imop(e,tp,eg,ep,ev,re,r,rp)
	local tc=Duel.GetFirstTarget()
	if not (tc and tc:IsRelateToEffect(e) and tc:IsFaceup()) then return end
	local e1=Effect.CreateEffect(e:GetHandler())
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_IMMUNE_EFFECT)
	e1:SetProperty(EFFECT_FLAG_SINGLE_RANGE+EFFECT_FLAG_CANNOT_DISABLE)
	e1:SetRange(LOCATION_MZONE)
	e1:SetValue(function(e,te) return te:GetOwnerPlayer()~=e:GetHandlerPlayer() end)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD+RESET_PHASE+PHASE_END)
	tc:RegisterEffect(e1)
end
