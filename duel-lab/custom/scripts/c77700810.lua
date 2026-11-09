--希望の勇者
--Hero of Hope (original card)
--② "a card with an effect that equips itself": the self-equipping cards of this theme are listed in SELF_EQUIP
--(Cursed Sword / Shield / Armor / Crown / Lightning Sword / Demon Axe / Holy Sword, Holy Sword of Hope).
--Cursed Treasure Chest and Cursed Hero do not equip themselves. Only Main Deck cards can be added.
--It destroys first; the search follows only if a card was destroyed ("破壊し、～加える").
local s,id=GetID()
local SELF_EQUIP={77700801,77700802,77700803,77700805,77700806,77700807,77700808,77700811}
function s.initial_effect(c)
	--① Special Summon procedure from the hand or GY (does not use the chain): send 1 other card from your hand or
	--   field to the GY. Summoned from the GY: you cannot Special Summon "Hero of Hope" for the rest of this turn.
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetCode(EFFECT_SPSUMMON_PROC)
	e1:SetProperty(EFFECT_FLAG_UNCOPYABLE)
	e1:SetRange(LOCATION_HAND+LOCATION_GRAVE)
	e1:SetCondition(s.spcon)
	e1:SetOperation(s.spop)
	e1:SetValue(1)
	c:RegisterEffect(e1)
	local e1b=Effect.CreateEffect(c)
	e1b:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_CONTINUOUS)
	e1b:SetCode(EVENT_SPSUMMON_SUCCESS)
	e1b:SetProperty(EFFECT_FLAG_CANNOT_DISABLE+EFFECT_FLAG_UNCOPYABLE)
	e1b:SetCondition(s.lockcon)
	e1b:SetOperation(s.lockop)
	c:RegisterEffect(e1b)
	--② (Quick) once per turn: destroy 1 card on the field, and add 1 self-equipping card from the Deck to the hand
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_DESTROY+CATEGORY_TOHAND+CATEGORY_SEARCH)
	e2:SetType(EFFECT_TYPE_QUICK_O)
	e2:SetCode(EVENT_FREE_CHAIN)
	e2:SetRange(LOCATION_MZONE)
	e2:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E)
	e2:SetCountLimit(1)
	e2:SetTarget(s.destg)
	e2:SetOperation(s.desop)
	c:RegisterEffect(e2)
end
s.listed_names={id,table.unpack(SELF_EQUIP)}
function s.costfilter(c,tp)
	return c:IsAbleToGraveAsCost() and Duel.GetMZoneCount(tp,c)>0
end
function s.spcon(e,c)
	if c==nil then return true end
	local tp=c:GetControler()
	if c:IsLocation(LOCATION_GRAVE) and aux.NecroValleyNegateCheck and aux.NecroValleyNegateCheck(c) then return false end
	return Duel.IsExistingMatchingCard(s.costfilter,tp,LOCATION_HAND+LOCATION_ONFIELD,0,1,c,tp)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp,c)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,s.costfilter,tp,LOCATION_HAND+LOCATION_ONFIELD,0,1,1,c,tp)
	Duel.SendtoGrave(g,REASON_COST)
end
function s.lockcon(e)
	local c=e:GetHandler()
	return c:GetSummonType()==SUMMON_TYPE_SPECIAL+1 and c:IsPreviousLocation(LOCATION_GRAVE)
end
function s.lockop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetProperty(EFFECT_FLAG_PLAYER_TARGET+EFFECT_FLAG_CLIENT_HINT)
	e1:SetCode(EFFECT_CANNOT_SPECIAL_SUMMON)
	e1:SetTargetRange(1,0)
	e1:SetTarget(function(e,sc) return sc:IsCode(id) end)
	e1:SetReset(RESET_PHASE+PHASE_END)
	Duel.RegisterEffect(e1,c:GetControler())
end
function s.thfilter(c)
	return c:IsCode(table.unpack(SELF_EQUIP)) and c:IsAbleToHand()
end
function s.destg(e,tp,eg,ep,ev,re,r,rp,chk)
	local g=Duel.GetFieldGroup(tp,LOCATION_ONFIELD,LOCATION_ONFIELD)
	if chk==0 then return #g>0 and Duel.IsExistingMatchingCard(s.thfilter,tp,LOCATION_DECK,0,1,nil) end
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,nil,1,PLAYER_ALL,LOCATION_ONFIELD)
	Duel.SetOperationInfo(0,CATEGORY_TOHAND,nil,1,tp,LOCATION_DECK)
end
function s.desop(e,tp,eg,ep,ev,re,r,rp)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local g=Duel.SelectMatchingCard(tp,nil,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,1,nil)
	if #g==0 then return end
	Duel.HintSelection(g)
	if Duel.Destroy(g,REASON_EFFECT)==0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_ATOHAND)
	local sg=Duel.SelectMatchingCard(tp,s.thfilter,tp,LOCATION_DECK,0,1,1,nil)
	if #sg>0 then
		Duel.SendtoHand(sg,nil,REASON_EFFECT)
		Duel.ConfirmCards(1-tp,sg)
	end
end
