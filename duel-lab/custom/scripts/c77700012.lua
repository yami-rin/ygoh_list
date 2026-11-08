--連鎖律の絶対定義
--Chain Code Absolute Definition (original card)
local s,id=GetID()
local SET_CHAIN_CODE=0x1f0
function s.initial_effect(c)
	--① negate the activation of a Spell/Trap/monster effect and destroy it; Chain Link 3+: "Chain Code" cards cannot be targeted this turn
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetCategory(CATEGORY_NEGATE+CATEGORY_DESTROY)
	e1:SetType(EFFECT_TYPE_ACTIVATE)
	e1:SetCode(EVENT_CHAINING)
	e1:SetCondition(s.condition)
	e1:SetTarget(s.target)
	e1:SetOperation(s.activate)
	c:RegisterEffect(e1)
	--can be activated the turn it was Set if it would be Chain Link 3 or higher
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_SINGLE)
	e2:SetCode(EFFECT_TRAP_ACT_IN_SET_TURN)
	e2:SetProperty(EFFECT_FLAG_SET_AVAILABLE)
	e2:SetCondition(function() return Duel.GetCurrentChain()>=2 end)
	c:RegisterEffect(e2)
end
s.listed_series={SET_CHAIN_CODE}
--"a Chain Code card on your field": cards other than this one (this card is always on the field while activating)
function s.cfilter(c,ec)
	return c~=ec and c:IsSetCard(SET_CHAIN_CODE) and (c:IsFaceup() or c:IsLocation(LOCATION_SZONE))
end
function s.condition(e,tp,eg,ep,ev,re,r,rp)
	return Duel.IsChainNegatable(ev) and Duel.IsExistingMatchingCard(s.cfilter,tp,LOCATION_ONFIELD,0,1,nil,e:GetHandler())
end
function s.target(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return true end
	e:SetLabel(Duel.GetCurrentChain())
	Duel.SetOperationInfo(0,CATEGORY_NEGATE,eg,1,0,0)
	if re:GetHandler():IsDestructable() and re:GetHandler():IsRelateToEffect(re) then
		Duel.SetOperationInfo(0,CATEGORY_DESTROY,eg,1,0,0)
	end
end
function s.activate(e,tp,eg,ep,ev,re,r,rp)
	if Duel.NegateActivation(ev) and re:GetHandler():IsRelateToEffect(re) then
		Duel.Destroy(eg,REASON_EFFECT)
	end
	if e:GetLabel()>=3 then
		--this turn, "Chain Code" cards on the field cannot be targeted by your opponent's effects
		local e1=Effect.CreateEffect(e:GetHandler())
		e1:SetType(EFFECT_TYPE_FIELD)
		e1:SetCode(EFFECT_CANNOT_BE_EFFECT_TARGET)
		e1:SetProperty(EFFECT_FLAG_IGNORE_IMMUNE)
		e1:SetTargetRange(LOCATION_ONFIELD,LOCATION_ONFIELD)
		e1:SetTarget(aux.TargetBoolFunction(Card.IsSetCard,SET_CHAIN_CODE))
		e1:SetValue(aux.tgoval)
		e1:SetReset(RESET_PHASE+PHASE_END)
		Duel.RegisterEffect(e1,tp)
	end
end
